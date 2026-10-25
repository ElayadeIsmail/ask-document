from pathlib import Path

from app.services.chunking import _split_text, extract_headings
from app.services.pdf_parser import PageContent, ParsedDocument


def test_split_text_respects_size_and_keeps_content():
    text = "First sentence. " * 80
    chunks = _split_text(text, chunk_size=120, overlap=20)
    assert len(chunks) > 1
    assert all(len(chunk) <= 160 for chunk in chunks)
    assert "First sentence" in chunks[0]


def test_extract_headings_from_title_case_lines():
    parsed = ParsedDocument(
        path=Path("demo.pdf"),
        page_count=1,
        metadata={},
        pages=[
            PageContent(
                page_number=1,
                text=(
                    "Annual Report 2024\n"
                    "This is a long paragraph that should not count as a heading.\n"
                    "Financial Overview\n"
                ),
            )
        ],
    )
    headings = extract_headings(parsed)
    assert "Annual Report 2024" in headings
    assert "Financial Overview" in headings
