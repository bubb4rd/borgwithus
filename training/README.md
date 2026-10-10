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
4. **Train** on an NVIDIA GPU. A free Google Colab T4 works: upload the script and the SFT file,
   then
   ```
   pip install unsloth
   python train_borg_lora.py borg-sft-YYYY-MM-DD.jsonl
   ```
   It trains a LoRA on `georgesung/llama2_7b_chat_uncensored` (the weights Ollama's
   llama2-uncensored is built from), merges it, and writes `borg-llama/` with a q4_k_m GGUF and a
   `Modelfile` that uses llama2-uncensored's own template (`### HUMAN:` / `### RESPONSE:`).
   The model server can't train: it runs the model on ~20 tokens a second of prompt reading.
5. **Install** on the Ollama server: copy `borg-llama/` over, then from inside it
   `ollama create borg-llama -f Modelfile`.
6. **Switch.** `npx supabase secrets set BORG_AI_MODEL=borg-llama`. This switches the Studio and
   member rolls together, so test it with a few Studio batches right after; switch back with
   `BORG_AI_MODEL=llama2-uncensored` if the "AI good" rate or the batch breakdown gets worse.

Untested here: the training run itself (it needs a GPU and the `unsloth`, `trl` and `datasets`
packages, whose APIs move fast). `--dry-run` and the export are tested.
