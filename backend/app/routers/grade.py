from fastapi import APIRouter

from ..llm import grade
from ..schemas import GradeRequest, GradeResult

router = APIRouter(tags=["grade"])


@router.post("/grade", response_model=GradeResult)
def grade_translation(req: GradeRequest) -> GradeResult:
    """Grade a spoken German translation of an English prompt.

    Used by both the translation-drill mode and (with target_de omitted) anywhere a
    free-form German answer needs judging.
    """
    return grade(req)
