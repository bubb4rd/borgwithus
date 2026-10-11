# BORG AI model server for a Runpod Serverless load balancing endpoint. Ollama answers the same
# /api/chat calls the edge functions already make; the model is baked in so a cold worker only
# has to load it into GPU memory, never download it. worker.py fronts Ollama on PORT (default 80)
# and answers the load balancer's GET /ping health check, which Ollama itself 404s.
#   endpoint: expose 80/http; no PORT, PORT_HEALTH or HEALTH_CHECK_PATH needed
FROM ollama/ollama:0.40.2

ARG MODEL=llama2-uncensored
ENV MODEL=$MODEL \
    OLLAMA_HOST=127.0.0.1:11434

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
