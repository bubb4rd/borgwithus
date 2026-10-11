"""Fine-tune llama2-uncensored on BORG names exported from the AI Borg Studio.

Trains a LoRA on the SFT file from the Studio's "Fine-tuning data" panel, merges it into the base
model and writes a 4-bit GGUF plus an Ollama Modelfile that uses llama2-uncensored's own prompt
template. Needs an NVIDIA GPU (a free Colab T4 is enough) with `pip install unsloth`. See
training/README.md for the whole loop.

    python train_borg_lora.py borg-sft-2026-10-10.jsonl --dry-run   # check the data, no GPU
    python train_borg_lora.py borg-sft-2026-10-10.jsonl             # train and export
"""

import argparse
import glob
import json
import os
import shutil

# The Hugging Face weights Ollama's llama2-uncensored is built from.
BASE_MODEL = "georgesung/llama2_7b_chat_uncensored"
# The base repo's tokenizer adds a [PAD] token at id 32000. Training with it grows the embedding
# to 32001 rows while the merged weights keep 32000, so the GGUF fails to load ("token_embd.weight
# has wrong shape"). This repo has the identical tokenizer.model without it: 32000 tokens, the
# same as llama2-uncensored in Ollama.
TOKENIZER = "unsloth/llama-2-7b"
GGUF = "borg-llama.Q4_K_M.gguf"

# llama2-uncensored's prompt template and stop words, as `ollama show llama2-uncensored` reports
# them. Training text must use the same template the model will be run with.
PROMPT = "{system}\n\n### HUMAN:\n{user}\n\n### RESPONSE:\n"
MODELFILE = '''FROM ./{gguf}
TEMPLATE """{{{{ .System }}}}

### HUMAN:
{{{{ .Prompt }}}}

### RESPONSE:
"""
PARAMETER stop "### HUMAN:"
PARAMETER stop "### RESPONSE:"
'''

MAX_LENGTH = 1024


def load_chats(path):
    """The Studio's SFT lines: {"messages": [system, user, assistant]}."""
    chats = []
    with open(path, encoding="utf-8") as handle:
        for number, line in enumerate(handle, 1):
            if not line.strip():
                continue
            roles = {m["role"]: m["content"] for m in json.loads(line)["messages"]}
            missing = {"system", "user", "assistant"} - roles.keys()
            if missing:
                raise SystemExit(f"{path}:{number}: missing {', '.join(sorted(missing))} message")
            chats.append(roles)
    if not chats:
        raise SystemExit(f"{path} has no chats")
    return chats


def to_text(chat, eos):
    """One training example: the prompt exactly as Ollama will build it, then the reply and EOS."""
    return PROMPT.format(system=chat["system"], user=chat["user"]) + chat["assistant"] + eos


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("sft", help="borg-sft-*.jsonl from the Studio")
    parser.add_argument("--out", default="borg-llama", help="output directory (default borg-llama)")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--dry-run", action="store_true", help="check and print the data, train nothing")
    args = parser.parse_args()

    chats = load_chats(args.sft)
    lines = sum(len(chat["assistant"].splitlines()) for chat in chats)
    print(f"{len(chats)} chats, {lines} names")
    if args.dry_run:
        print("--- first example ---")
        print(to_text(chats[0], "</s>"))
        return

    # Imported here so --dry-run works without a GPU or these packages. Unsloth goes first: it
    # patches trl and transformers on import.
    from unsloth import FastLanguageModel
    from datasets import Dataset
    from trl import SFTConfig, SFTTrainer

    model, tokenizer = FastLanguageModel.from_pretrained(
        BASE_MODEL, tokenizer_name=TOKENIZER, max_seq_length=MAX_LENGTH, load_in_4bit=True
    )
    model = FastLanguageModel.get_peft_model(
        model,
        r=16,
        lora_alpha=16,
        lora_dropout=0,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        use_gradient_checkpointing="unsloth",
        random_state=3407,
    )
    dataset = Dataset.from_list([{"text": to_text(chat, tokenizer.eos_token)} for chat in chats])
    trainer = SFTTrainer(
        model=model,
        processing_class=tokenizer,
        train_dataset=dataset,
        args=SFTConfig(
            dataset_text_field="text",
            max_length=MAX_LENGTH,
            per_device_train_batch_size=2,
            gradient_accumulation_steps=4,
            num_train_epochs=args.epochs,
            learning_rate=2e-4,
            logging_steps=5,
            output_dir=os.path.join(args.out, "checkpoints"),
            report_to="none",
        ),
    )
    trainer.train()

    # Merges the LoRA into the base and writes a q4_k_m GGUF, the size llama2-uncensored ships at.
    # The merged weights are only the converter's input and as large as the base download, so
    # they go in a scratch folder that is removed once the GGUF is out. Unsloth writes the GGUF to
    # a folder beside it (merged_gguf/ in current versions), hence the search.
    merged = os.path.join(args.out, "merged")
    model.save_pretrained_gguf(merged, tokenizer, quantization_method="q4_k_m")
    ggufs = sorted(glob.glob(os.path.join(merged + "*", "**", "*.gguf"), recursive=True), key=os.path.getmtime)
    if not ggufs:
        raise SystemExit(f"No GGUF written under {args.out}")
    os.replace(ggufs[-1], os.path.join(args.out, GGUF))
    for scratch in (merged, merged + "_gguf"):
        shutil.rmtree(scratch, ignore_errors=True)
    with open(os.path.join(args.out, "Modelfile"), "w", encoding="utf-8") as handle:
        handle.write(MODELFILE.format(gguf=GGUF))
    print(f"Wrote {args.out}/{GGUF} and {args.out}/Modelfile")


if __name__ == "__main__":
    main()
