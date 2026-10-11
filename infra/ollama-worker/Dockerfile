# BORG AI model server for a Runpod Serverless load balancing endpoint. Ollama answers the same
# /api/chat calls the edge functions already make; the model is baked in so a cold worker only
# has to load it into GPU memory, never download it. worker.py fronts Ollama on PORT (default 80)
# and answers the load balancer's GET /ping health check, which Ollama itself 404s.
#   endpoint: expose 80/http; no PORT, PORT_HEALTH or HEALTH_CHECK_PATH needed
FROM ollama/ollama:0.40.2

ARG MODEL=llama2-uncensored
# Models live outside /root: on Runpod workers /root/.ollama/models came up empty ("total
# blobs: 0") although the pull is in the image. 2048 is llama2-uncensored's own context; left
# unset, Ollama sizes it from VRAM (32768 on a 24 GB card) and loads far more than a roll needs.
ENV MODEL=$MODEL \
    OLLAMA_HOST=127.0.0.1:11434 \
    OLLAMA_MODELS=/models \
    OLLAMA_CONTEXT_LENGTH=2048

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 && \
    rm -rf /var/lib/apt/lists/*

RUN ollama serve & pid=$! && \
    until ollama list >/dev/null 2>&1; do sleep 1; done && \
    ollama pull "$MODEL" && \
    kill "$pid"

COPY worker.py /worker.py

EXPOSE 80
ENTRYPOINT ["/bin/sh", "-c", "ollama serve & exec python3 /worker.py"]
CMD []
