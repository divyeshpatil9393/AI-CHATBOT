"""Sentence-aware chunking with configurable size and overlap."""
from dataclasses import dataclass

from nlp.preprocessing import split_paragraphs, split_sentences


@dataclass(frozen=True)
class Unit:
    text: str
    page: int  # 0 = unknown (DOCX/TXT have no fixed pages)
    sep: str   # separator placed before this unit: "\n\n", "\n" or " "


@dataclass(frozen=True)
class Chunk:
    index: int
    text: str
    page_start: int
    page_end: int


_SENTENCE_FINAL = (".", "!", "?", ":", '"', ")")


def _units_from_pages(pages: list[tuple[int, str]]) -> list[Unit]:
    units: list[Unit] = []
    for page, text in pages:
        first_in_page = True
        for paragraph in split_paragraphs(text):
            for line_no, line in enumerate(paragraph.split("\n")):
                for sent_no, sentence in enumerate(split_sentences(line)):
                    if line_no == 0 and sent_no == 0:
                        sep = "\n\n"
                    elif sent_no == 0:
                        sep = "\n"
                    else:
                        sep = " "
                    # A sentence that runs across a PDF page break stays one flow of text.
                    if first_in_page and units and sep == "\n\n":
                        previous = units[-1].text.rstrip()
                        if not previous.endswith(_SENTENCE_FINAL) and sentence[:1].islower():
                            sep = " "
                    first_in_page = False
                    units.append(Unit(sentence, page, sep))
    return units


def _split_oversized(unit: Unit, size: int) -> list[Unit]:
    if len(unit.text) <= size:
        return [unit]
    pieces: list[Unit] = []
    current = ""
    for word in unit.text.split(" "):
        while len(word) > size:  # pathological token (e.g. a long URL)
            if current:
                pieces.append(Unit(current, unit.page, unit.sep if not pieces else " "))
                current = ""
            pieces.append(Unit(word[:size], unit.page, unit.sep if not pieces else " "))
            word = word[size:]
        if current and len(current) + 1 + len(word) > size:
            pieces.append(Unit(current, unit.page, unit.sep if not pieces else " "))
            current = word
        else:
            current = f"{current} {word}" if current else word
    if current:
        pieces.append(Unit(current, unit.page, unit.sep if not pieces else " "))
    return pieces


def _join(units: list[Unit]) -> str:
    return "".join((u.sep if i else "") + u.text for i, u in enumerate(units))


def _overlap_tail(units: list[Unit], overlap: int) -> list[Unit]:
    """Trailing whole sentences totalling at most `overlap` characters."""
    if overlap <= 0 or len(units) < 2:
        return []
    tail: list[Unit] = []
    total = 0
    for unit in reversed(units[1:]):  # never carry the entire chunk over
        total += len(unit.text) + len(unit.sep)
        if total > overlap:
            break
        tail.insert(0, unit)
    return tail


def build_chunks(pages: list[tuple[int, str]], chunk_size: int, chunk_overlap: int) -> list[Chunk]:
    """Group sentences into chunks of roughly `chunk_size` characters.

    Chunks end on sentence boundaries wherever possible, and consecutive chunks share up to
    `chunk_overlap` characters of trailing sentences so context isn't lost at the seams.
    """
    chunk_overlap = min(chunk_overlap, chunk_size // 2)
    chunks: list[Chunk] = []
    current: list[Unit] = []
    has_new_content = False

    def flush() -> None:
        text = _join(current).strip()
        if text and any(ch.isalnum() for ch in text):
            chunks.append(Chunk(len(chunks), text, current[0].page, current[-1].page))

    for unit in _units_from_pages(pages):
        for piece in _split_oversized(unit, chunk_size):
            if current and len(_join(current + [piece])) > chunk_size:
                flush()
                current = _overlap_tail(current, chunk_overlap)
                has_new_content = False
            current.append(piece)
            has_new_content = True

    if current and has_new_content:
        flush()
    return chunks
