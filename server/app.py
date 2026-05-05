from typing import TypedDict, Annotated, Optional
from langgraph.graph import add_messages, StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessageChunk, ToolMessage, SystemMessage
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_core.tools import tool
from fastapi import FastAPI, Query, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from langchain.tools import StructuredTool
import json
import os
import io
import re
from uuid import uuid4

# ── Optional RAG imports ──────────────────────────────────────────────────────
try:
    import faiss
    from sentence_transformers import SentenceTransformer
    RAG_AVAILABLE = True
except ImportError:
    RAG_AVAILABLE = False
    print("WARNING: faiss-cpu or sentence-transformers not installed. RAG disabled.")

try:
    import pdfplumber
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False

try:
    from docx import Document as DocxDocument
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False

load_dotenv()

# ── Embedding model ───────────────────────────────────────────────────────────
if RAG_AVAILABLE:
    embedder = SentenceTransformer("all-MiniLM-L6-v2")

# ── In-memory document store  { thread_id -> {index, chunks, filename} } ─────
doc_store: dict = {}

# ── Text processing helpers ───────────────────────────────────────────────────

def _chunk_text(text: str, size: int = 500, overlap: int = 50) -> list[str]:
    words = text.split()
    chunks, i = [], 0
    while i < len(words):
        chunks.append(" ".join(words[i: i + size]))
        i += size - overlap
    return [c for c in chunks if c.strip()]


def _extract_text(file_bytes: bytes, filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext == "txt":
        return file_bytes.decode("utf-8", errors="ignore")
    if ext == "pdf":
        if not PDF_AVAILABLE:
            raise RuntimeError("pdfplumber not installed")
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            return "\n".join(p.extract_text() or "" for p in pdf.pages)
    if ext == "docx":
        if not DOCX_AVAILABLE:
            raise RuntimeError("python-docx not installed")
        doc = DocxDocument(io.BytesIO(file_bytes))
        return "\n".join(p.text for p in doc.paragraphs)
    raise ValueError(f"Unsupported file type: .{ext}")


def _build_index(chunks: list[str]):
    vecs = embedder.encode(chunks, show_progress_bar=False).astype("float32")
    index = faiss.IndexFlatL2(vecs.shape[1])
    index.add(vecs)
    return index


def _thread_docs(thread_id: str) -> list[dict]:
    entry = doc_store.get(thread_id)
    if not entry:
        return []
    if "docs" in entry:
        return entry["docs"]
    return [entry]


def _retrieve(thread_id: str, query: str, k: int = 4, doc_id: Optional[str] = None) -> str:
    docs = _thread_docs(thread_id)
    if not docs:
        return ""
    if doc_id:
        docs = [doc for doc in docs if doc.get("doc_id") == doc_id] or docs

    q_vec = embedder.encode([query]).astype("float32")
    results = []
    per_doc_k = max(1, k if len(docs) == 1 else 2)
    for doc in docs:
        _, indices = doc["index"].search(q_vec, per_doc_k)
        for i in indices[0]:
            if i < len(doc["chunks"]):
                filename = doc.get("filename", "uploaded document")
                results.append(f"From {filename}:\n{doc['chunks'][i]}")
    results = results[:k]
    return "\n\n---\n\n".join(results)

# ── LLM ───────────────────────────────────────────────────────────────────────
llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    groq_api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.7,
    streaming=True,
)

# ── Tools ─────────────────────────────────────────────────────────────────────
search_tool = TavilySearchResults(max_results=4)


def make_doc_search_tool(thread_id: str, doc_id: Optional[str] = None):
    @tool
    def search_documents(query: str) -> str:
        """Search the user's uploaded documents for relevant information.
        Use this when the user asks about a document they uploaded, or refers to
        'the file', 'the document', 'the PDF', 'the report', etc."""
        result = _retrieve(thread_id, query, doc_id=doc_id)
        return result if result else "No relevant content found in the uploaded documents."
    return search_documents

# ── LangGraph state ───────────────────────────────────────────────────────────
class State(TypedDict):
    messages: Annotated[list, add_messages]
    thread_id: str
    document_context: Optional[str]

# Context window: only keep last N human+AI turns to avoid token bloat
CONTEXT_WINDOW = 10

SYSTEM_PROMPT = """You are a helpful AI assistant similar to Perplexity.
You have one external tool:
1. tavily_search_results_json - search the web for current or factual information.

Tool selection rules:
- If uploaded document context is provided, use it as the primary source for document questions.
- If the question requires current events, news, live data, use tavily_search.
- If neither is needed, answer from your own knowledge.

IMPORTANT — Context awareness:
- You can see the full conversation history. Use it.
- If a user asks to "simplify", "explain again", or "elaborate", refer to your PREVIOUS answer.
- If a concept was already explained, build on it rather than repeating from scratch.

After your main answer, on a NEW LINE output exactly:
FOLLOW_UPS: ["question 1", "question 2", "question 3"]
These should be natural follow-up questions the user might want to ask next.
"""

memory = MemorySaver()

# ── Graph nodes ───────────────────────────────────────────────────────────────

async def model_node(state: State):
    active_tools = [search_tool]

    llm_with_tools = llm.bind_tools(active_tools)

    # Sliding context window: keep system prompt + last N messages
    all_msgs = list(state["messages"])
    windowed = all_msgs[-CONTEXT_WINDOW:] if len(all_msgs) > CONTEXT_WINDOW else all_msgs

    messages = [SystemMessage(content=SYSTEM_PROMPT)]
    document_context = state.get("document_context")
    if document_context:
        messages.append(SystemMessage(content=f"Uploaded document context:\n{document_context}"))
    messages += windowed
    response = await llm_with_tools.ainvoke(messages)
    return {"messages": [response]}


async def tools_router(state: State):
    last = state["messages"][-1]
    if hasattr(last, "tool_calls") and len(last.tool_calls) > 0:
        return "tool_node"
    return END


async def tool_node(state: State):
    thread_id = state.get("thread_id", "")
    doc_tool = make_doc_search_tool(thread_id)
    tool_map = {
        "tavily_search_results_json": search_tool,
        "search_documents": doc_tool,
    }
    tool_messages = []
    for call in state["messages"][-1].tool_calls:
        name = call["name"]
        if name in tool_map:
            result = await tool_map[name].ainvoke(call["args"])
            tool_messages.append(
                ToolMessage(content=str(result), tool_call_id=call["id"], name=name)
            )
    return {"messages": tool_messages}

# ── Build graph ───────────────────────────────────────────────────────────────
graph_builder = StateGraph(State)
graph_builder.add_node("model_node", model_node)
graph_builder.add_node("tool_node", tool_node)
graph_builder.set_entry_point("model_node")
graph_builder.add_conditional_edges("model_node", tools_router)
graph_builder.add_edge("tool_node", "model_node")
graph = graph_builder.compile(checkpointer=memory)

# ── FastAPI ───────────────────────────────────────────────────────────────────
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Type"],
)


@app.get("/health")
async def health():
    return {"ok": True}


def _safe(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
            .replace('"', '\\"')
            .replace("\n", "\\n")
            .replace("\r", "\\r")
    )


def _extract_follow_ups(text: str) -> tuple[str, list[str]]:
    """Pull FOLLOW_UPS: [...] off the end of the model response."""
    pattern = r'FOLLOW_UPS:\s*(\[.*?\])\s*$'
    match = re.search(pattern, text, re.DOTALL)
    if match:
        clean_text = text[:match.start()].rstrip()
        try:
            questions = json.loads(match.group(1))
            return clean_text, questions
        except json.JSONDecodeError:
            pass
    return text, []


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

# ── Upload endpoint ───────────────────────────────────────────────────────────

@app.post("/upload")
async def upload_document(file: UploadFile = File(...), thread_id: str = Form(...)):
    if not RAG_AVAILABLE:
        return {"error": "RAG dependencies not installed."}
    file_bytes = await file.read()
    try:
        text = _extract_text(file_bytes, file.filename)
    except Exception as e:
        return {"error": str(e)}

    chunks = _chunk_text(text)
    if not chunks:
        return {"error": "Could not extract any text from the file."}

    doc_id = str(uuid4())
    file_type = file.filename.rsplit(".", 1)[-1].lower()
    doc_entry = {
        "doc_id": doc_id,
        "index": _build_index(chunks),
        "chunks": chunks,
        "filename": file.filename,
        "file_type": file_type,
        "text": text,
    }
    thread_entry = doc_store.setdefault(thread_id, {"active_doc_id": doc_id, "docs": []})
    thread_entry["docs"].append(doc_entry)
    thread_entry["active_doc_id"] = doc_id
    return {
        "ok": True,
        "doc_id": doc_id,
        "filename": file.filename,
        "file_type": file_type,
        "chunks": len(chunks),
        "thread_id": thread_id,
        "text": text,
    }

# ── Chat stream endpoint ──────────────────────────────────────────────────────

async def generate_chat_responses(
    message: str,
    checkpoint_id: Optional[str] = None,
    active_doc_id: Optional[str] = None,
):
    is_new = checkpoint_id is None
    thread_id = str(uuid4()) if is_new else checkpoint_id
    config = {"configurable": {"thread_id": thread_id}}

    # Always send checkpoint so frontend can track the thread
    yield _sse({"type": "checkpoint", "checkpoint_id": thread_id})

    document_context = ""
    if thread_id in doc_store:
        active_doc_id = active_doc_id or doc_store[thread_id].get("active_doc_id")
        document_context = _retrieve(thread_id, message, doc_id=active_doc_id)
        if document_context:
            yield _sse({"type": "doc_search_start", "query": message})
            yield _sse({"type": "doc_search_done"})

    events = graph.astream_events(
        {
            "messages": [HumanMessage(content=message)],
            "thread_id": thread_id,
            "document_context": document_context,
        },
        version="v2",
        config=config,
    )

    full_response = ""

    try:
        async for event in events:
            etype = event["event"]

            if etype == "on_chat_model_stream":
                chunk: AIMessageChunk = event["data"]["chunk"]
                if isinstance(chunk.content, str) and chunk.content:
                    full_response += chunk.content
                    yield _sse({"type": "content", "content": chunk.content})

            elif etype == "on_chat_model_end":
                output = event["data"].get("output")
                tool_calls = getattr(output, "tool_calls", [])
                for call in tool_calls:
                    if call["name"] == "tavily_search_results_json":
                        query = call["args"].get("query", "")
                        yield _sse({"type": "search_start", "query": query})

            elif etype == "on_tool_end":
                name = event.get("name", "")
                if name == "tavily_search_results_json":
                    output = event["data"].get("output", [])
                    urls = [item["url"] for item in output if isinstance(item, dict) and "url" in item]
                    yield _sse({"type": "search_results", "urls": urls})
    except Exception as e:
        yield _sse({"type": "search_error", "error": str(e)})
        yield _sse({"type": "end"})
        return

    # Extract follow-up questions from the full response and send them
    _, follow_ups = _extract_follow_ups(full_response)
    if follow_ups:
        yield _sse({"type": "follow_ups", "questions": follow_ups})

    yield _sse({"type": "end"})


@app.get("/chat_stream/{message}")
async def chat_stream(
    message: str,
    checkpoint_id: Optional[str] = Query(None),
    active_doc_id: Optional[str] = Query(None),
):
    return StreamingResponse(
        generate_chat_responses(message, checkpoint_id, active_doc_id),
        media_type="text/event-stream",
    )
