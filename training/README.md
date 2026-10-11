# Fine-tuning BORG AI

The prompt can only steer llama2-uncensored so far; fine-tuning teaches it the sound swap itself
from the names you've approved. The loop:

1. **Collect.** Rate Studio batches (👍, ✏️ fixes, 👎 with a reason), ⭐ good names into the
   example pool, and let members ❤️/👎 live names. The Studio's "Fine-tuning data" panel counts
   usable pairs; a LoRA starts paying off around 300. Below that it mostly memorises the names.
2. **Export.** In the panel, "Build training files", then "Download SFT". Each line is one chat
   shaped like a real roll: the live prompt version as the system message, the theme, and up to 5
   `Original -> BORG name` lines. It holds ✏️ fixed names, 👍 names, live names members liked
   more than they disliked, and the example pool, one per name; a name whose latest rating is 👎
   is left out. "Download DPO" holds one preference per ✏️ fix (fixed name over the model's), for a
   later preference-tuning pass; `train_borg_lora.py` only uses the SFT file.
3. **Check the data** (no GPU needed):
   `python training/train_borg_lora.py borg-sft-YYYY-MM-DD.jsonl --dry-run`
   prints the count and the first example exactly as the model will see it.
4. **Train** on an NVIDIA GPU with 8 GB or more, from a work folder outside OneDrive (the run
   writes tens of GB). Locally on Windows (tested on an RTX 3070 Ti, 8 GB):
   ```
   python -m pip install uv
   python -m uv venv --python 3.12 C:\Users\<you>\borg-train\.venv
   python -m uv pip install --python C:\Users\<you>\borg-train\.venv\Scripts\python.exe torch torchvision --index-url https://download.pytorch.org/whl/cu130
   python -m uv pip install --python C:\Users\<you>\borg-train\.venv\Scripts\python.exe unsloth --extra-index-url https://download.pytorch.org/whl/cu130 --index-strategy unsafe-best-match
   cd C:\Users\<you>\borg-train
   .venv\Scripts\python.exe <repo>\training\train_borg_lora.py borg-sft-YYYY-MM-DD.jsonl
   ```
   (`cu130` matches a driver reporting CUDA 13.x in `nvidia-smi`.) A free Google Colab T4 also
   works: upload the script and the SFT file, `pip install unsloth`, run the same command.

   It trains a LoRA on `georgesung/llama2_7b_chat_uncensored` (the weights Ollama's
   llama2-uncensored is built from), merges it, and writes `borg-llama/borg-llama.Q4_K_M.gguf` and
   a `Modelfile` that uses llama2-uncensored's own template (`### HUMAN:` / `### RESPONSE:`).
   Disk: the base weights are float32, a 27 GB one-time download into the Hugging Face cache; the
   merge and conversion need about 40 GB more while they run and are deleted after. The first
   run sets up llama.cpp in `~/.unsloth` (on Windows it installed OpenSSL through winget and built
   llama.cpp with CMake, a few minutes). Training itself takes seconds per step; the merge and
   GGUF conversion take about 10 minutes.
   The model server can't train: it runs the model on ~20 tokens a second of prompt reading.
5. **Install** on the Ollama server: copy `borg-llama.Q4_K_M.gguf` and `Modelfile` over (the
   `checkpoints/` folder isn't needed), then from that folder `ollama create borg-llama -f Modelfile`.
6. **Switch.** `npx supabase secrets set BORG_AI_MODEL=borg-llama`. This switches the Studio and
   member rolls together, so test it with a few Studio batches right after; switch back with
   `BORG_AI_MODEL=llama2-uncensored` if the "AI good" rate or the batch breakdown gets worse.

Tested end to end on Windows: train, GGUF export, `ollama create`, and a roll through `/api/chat`
with the live system prompt. `unsloth`, `trl` and `datasets` APIs move fast, so a new version may
need the script adjusted.

Known gap: training chats carry only the theme as the user message, while a live roll's user
message also lists format examples, "More BORG names" and used names/originals
(`buildMessages` in `supabase/functions/_shared/borg-ai.ts`). The model is tuned on a shorter
prompt than it is served.
