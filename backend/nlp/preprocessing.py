"""Text cleaning, normalization and sentence/paragraph segmentation.

Pure Python (no NLTK/spaCy downloads) so the project installs cleanly on Windows.
"""
import re
import unicodedata

_INVISIBLE = dict.fromkeys(map(ord, "\u200b\u200c\u200d\u2060\ufeff\u00ad"), None)
_PUNCT_MAP = str.maketrans(
    {
        "\u2018": "'", "\u2019": "'", "\u201a": "'",
        "\u201c": '"', "\u201d": '"', "\u201e": '"',
        "\u2013": "-", "\u2014": " - ", "\u2212": "-",
        "\u2022": "-", "\u25cf": "-", "\u25aa": "-", "\u00b7": "-",
    }
)

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_INLINE_SPACES = re.compile(r"[ \t\f\v]+")
_BLANK_RUNS = re.compile(r"\n{3,}")
_HYPHEN_LINEBREAK = re.compile(r"(?<=[a-z])-\n(?=[a-z])")  # "compu-\ntation" -> "computation"
_REPEATED_DECOR = re.compile(r"([\-_=*~#.])\1{3,}")
_PAGE_NUMBER_LINE = re.compile(r"^(page\s+)?\d{1,4}(\s*(/|of)\s*\d{1,4})?$", re.IGNORECASE)
_LIST_LINE = re.compile(r"^([-*]|\d+[.)])\s+")

_SENTENCE_END = re.compile(r"""([.!?]["')\]]*)\s+(?=["'(\[]?[A-Z0-9])""")
_ABBREVIATIONS = {
    "mr.", "mrs.", "ms.", "dr.", "prof.", "sr.", "jr.", "st.", "vs.", "e.g.", "i.e.",
    "fig.", "no.", "vol.", "pp.", "cf.", "al.",
}


def normalize_unicode(text: str) -> str:
    """NFKC normalization (fixes ligatures, full-width chars, nbsp), plus quote/dash folding."""
    text = unicodedata.normalize("NFKC", text)
    text = text.translate(_INVISIBLE)
    return text.translate(_PUNCT_MAP)


def _is_noise(line: str, strip_page_numbers: bool) -> bool:
    if strip_page_numbers and _PAGE_NUMBER_LINE.match(line):
        return True
    # Decorative rules such as "-----" or "* * *" carry no information.
    return len(line) >= 3 and not re.search(r"\w", line)


def clean_text(text: str, strip_page_numbers: bool = True) -> str:
    """Normalize and clean raw extracted text while keeping paragraph breaks."""
    if not text:
        return ""
    text = normalize_unicode(text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _CONTROL_CHARS.sub("", text)
    text = _HYPHEN_LINEBREAK.sub("", text)

    lines: list[str] = []
    for raw in text.split("\n"):
        line = _INLINE_SPACES.sub(" ", raw).strip()
        if line and _is_noise(line, strip_page_numbers):
            continue
        lines.append(line)

    text = "\n".join(lines)
    text = _REPEATED_DECOR.sub(r"\1\1\1", text)
    text = _BLANK_RUNS.sub("\n\n", text)
    return text.strip()


def split_paragraphs(text: str) -> list[str]:
    """Split cleaned text into paragraphs, re-joining hard-wrapped prose lines (typical of PDFs)."""
    paragraphs: list[str] = []
    for block in re.split(r"\n\s*\n", text):
        lines = [ln.strip() for ln in block.split("\n") if ln.strip()]
        if not lines:
            continue
        is_list = any(_LIST_LINE.match(ln) for ln in lines)
        average_length = sum(len(ln) for ln in lines) / len(lines)
        if len(lines) > 1 and not is_list and average_length >= 45:
            paragraphs.append(" ".join(lines))
        else:
            paragraphs.append("\n".join(lines))
    return paragraphs


def split_sentences(text: str) -> list[str]:
    """Rule-based sentence splitter that respects common abbreviations and initials."""
    sentences: list[str] = []
    start = 0
    for match in _SENTENCE_END.finditer(text):
        candidate = text[start : match.end(1)]
        tokens = candidate.split()
        last = tokens[-1].lower() if tokens else ""
        if last in _ABBREVIATIONS or re.fullmatch(r"[a-z]\.", last):
            continue
        sentences.append(candidate.strip())
        start = match.end()
    tail = text[start:].strip()
    if tail:
        sentences.append(tail)
    return [s for s in sentences if s]


def normalize_query(question: str) -> str:
    """Light normalization for user questions before embedding."""
    return _INLINE_SPACES.sub(" ", normalize_unicode(question)).strip()
