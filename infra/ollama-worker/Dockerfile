# BORG AI model server for a Runpod Serverless load balancing endpoint. Ollama answers the same
# /api/chat calls the edge functions already make; the model is baked in so a cold worker only
# has to load it into GPU memory, never download it.
#   endpoint env: PORT=11434, HEALTH_CHECK_PATH=/  (Ollama's / returns 200 "Ollama is running")
FROM ollama/ollama:0.40.2

ARG MODEL=llama2-uncensored
RUN ollama serve & pid=$! && \
    until ollama list >/dev/null 2>&1; do sleep 1; done && \
    ollama pull "$MODEL" && \
    kill "$pid"

EXPOSE 11434
