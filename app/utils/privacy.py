from typing import Optional


def mask_cpf_cnpj(valor: Optional[str]) -> Optional[str]:
    if not valor:
        return valor
    digits = ''.join(ch for ch in str(valor) if ch.isdigit())
    if not digits:
        return valor
    length = len(digits)
    if length == 11:
        return f"***.***.***-{digits[-2:]}"
    if length == 14:
        return f"**.***.***/****-{digits[-2:]}"
    if length > 4:
        return f"{'*' * (length - 4)}{digits[-4:]}"
    return '*' * (max(length - 1, 0)) + digits[-1:]


def mask_phone(valor: Optional[str]) -> Optional[str]:
    if not valor:
        return valor
    digits = ''.join(ch for ch in str(valor) if ch.isdigit())
    if len(digits) < 4:
        return '*' * len(digits)

    if len(digits) == 10:
        return f"({digits[:2]}) ****-{digits[6:]}"
    if len(digits) == 11:
        return f"({digits[:2]}) *****-{digits[7:]}"

    return '*' * (len(digits) - 4) + digits[-4:]
