# RAG PDF Chatbot

A chatbot that answers questions about your PDFs, with page-level citations,
multi-document support, chat memory, and login — built entirely with free tools.

## Features
- Upload multiple PDFs at once, ask questions across all of them
- Answers cite the exact source file + page number
- Remembers recent conversation turns (handles follow-up questions)
- Login screen (no public, unauthenticated access to your API quota)
- 100% free stack: local embeddings, FAISS, Groq's free LLM API

## Architecture (why each piece is there)

| Piece | Tool | Why |
|---|---|---|
| PDF parsing | `pypdf` | Extracts text page-by-page (needed for citations) |
| Chunking | custom sliding window | Splits long pages into LLM-sized pieces, with overlap so ideas aren't cut in half |
| Embeddings | `sentence-transformers` (`all-MiniLM-L6-v2`) | Runs locally, free, no API key, no rate limit |
| Vector DB | FAISS (`IndexFlatIP`) | Free, in-memory, exact nearest-neighbor search — fine up to ~100k chunks |
| LLM | Groq API (`llama-3.3-70b-versatile`) | Free tier, very fast inference |
| Auth | `streamlit-authenticator` | Bcrypt-hashed passwords, cookie sessions, no external auth provider needed |
| UI + hosting | Streamlit + Streamlit Community Cloud | Free, deploys straight from GitHub |

## Local setup

1. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Get a free Groq API key**
   - Go to https://console.groq.com → sign up (free) → create an API key

3. **Create your login credentials**
   ```bash
   python generate_config.py
   ```
   This creates `config.yaml` with your hashed password. Never edit this file by hand to add a plain-text password.

4. **Add your API key locally**
   Create a folder `.streamlit/` and a file inside it `.streamlit/secrets.toml`:
   ```toml
   GROQ_API_KEY = "gsk_your_key_here"
   ```

5. **Run it**
   ```bash
   streamlit run app.py
   ```

## Deploying for free (Streamlit Community Cloud)

1. Push this folder to a **public** (or private, if your plan allows) GitHub repo.
   - Do NOT commit `config.yaml` if it has a real password you reuse elsewhere — for a portfolio demo, a throwaway demo password is fine to commit.
   - Do NOT commit `.streamlit/secrets.toml` ever — your API key would be exposed publicly. Add both to `.gitignore` if you're cautious (see below).

2. Go to https://share.streamlit.io → Sign in with GitHub → "New app" → pick your repo → set main file to `app.py`.

3. In the app's settings, find **Secrets** and paste:
   ```toml
   GROQ_API_KEY = "gsk_your_key_here"
   ```
   This is the cloud equivalent of your local `secrets.toml` — Streamlit injects it as `st.secrets`.

4. If you didn't commit `config.yaml`, you'll also need to either commit it (demo password) or add its contents as a secret and adjust `auth.py` to read from `st.secrets` instead of a file (slightly more advanced — ask me if you want this version).

5. Click Deploy. You'll get a public URL like `yourapp.streamlit.app`.

## Suggested `.gitignore`
```
.streamlit/secrets.toml
__pycache__/
*.pyc
vector_store/
```

## How the RAG pipeline actually works (recap)
1. PDF → text, page by page
2. Text → overlapping chunks (~800 characters each)
3. Each chunk → embedding vector (meaning as numbers)
4. All vectors → FAISS index
5. User question → embedding → FAISS finds the closest chunk vectors
6. Those chunks + recent chat history + question → sent to the LLM
7. LLM answers using only that context → citations shown alongside

## Ideas to extend this further (great for "v2" on your resume)
- Swap FAISS for **Pinecone** or **Chroma** with persistent cloud storage so the index survives redeploys
- Add **re-ranking**: retrieve 20 chunks with FAISS, then re-rank with a cross-encoder for higher precision
- Add **streaming responses** (Groq supports `stream=True`) so answers appear word-by-word
- Add **per-user document isolation** with real accounts + a database instead of session state
- Add **evaluation**: a small set of Q&A pairs to measure retrieval accuracy over time
