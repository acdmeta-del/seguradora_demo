#!/usr/bin/env bash
# Gera um token_usuario novo da Hinova (POST /usuario/autenticar), para HINOVA_TOKEN no
# Easypanel e para o n8n. Documentação: docs/api/hinova-sga-api-v2.md, seção 1.
#
# Uso (Ubuntu), no SEU computador:
#   bash server/scripts/gerar-token-hinova.sh
#   bash server/scripts/gerar-token-hinova.sh --salvar ~/token-hinova.txt   # grava num arquivo só seu (600)
#
# Pede o token do painel (Área Cliente > APIs > Gerenciar APIs), o usuário e a senha do SGA.
# Token e senha não aparecem na tela, não vão para o histórico do terminal nem para a lista
# de processos (vão por arquivo temporário legível só por você, apagado no fim).
# Precisa de: curl e python3 (já vêm no Ubuntu; senão: sudo apt install curl python3).
set -euo pipefail

BASE="${HINOVA_BASE_URL:-https://api.hinova.com.br/api/sga/v2}"
BASE="${BASE%/}"
SALVAR=""
if [[ "${1:-}" == "--salvar" ]]; then
  SALVAR="${2:?Informe o arquivo: --salvar ~/token-hinova.txt}"
elif [[ -n "${1:-}" ]]; then
  echo "Uso: $0 [--salvar ARQUIVO]" >&2; exit 2
fi
for prog in curl python3; do
  command -v "$prog" >/dev/null || { echo "Falta o $prog. Instale com: sudo apt install $prog" >&2; exit 1; }
done

TMP="$(mktemp -d)"; chmod 700 "$TMP"
trap 'rm -rf "$TMP"' EXIT

read -rsp "Token do painel (Gerenciar APIs): " TOKEN_SGA; echo
read -rp  "Usuário do SGA: " USUARIO
read -rsp "Senha do SGA: " SENHA; echo
# Limpa espaços nas pontas e um "Bearer " colado por engano
TOKEN_SGA="$(printf '%s' "$TOKEN_SGA" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g; s/^[Bb]earer[[:space:]]+//')"
USUARIO="$(printf '%s' "$USUARIO" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
[[ -n "$TOKEN_SGA" && -n "$USUARIO" && -n "$SENHA" ]] || { echo "Token, usuário e senha são obrigatórios." >&2; exit 1; }

# Cabeçalho e corpo em arquivos 600 (nada de segredo na linha de comando do curl)
umask 077
printf 'Authorization: Bearer %s\n' "$TOKEN_SGA" > "$TMP/cabecalho"
USUARIO="$USUARIO" SENHA="$SENHA" python3 -c 'import json, os; print(json.dumps({"usuario": os.environ["USUARIO"], "senha": os.environ["SENHA"]}))' > "$TMP/corpo"
unset TOKEN_SGA SENHA

echo "Autenticando em $BASE/usuario/autenticar ..."
STATUS="$(curl -sS -o "$TMP/resposta" -w '%{http_code}' --max-time 30 -X POST "$BASE/usuario/autenticar" \
  -H "Content-Type: application/json" -H "Accept: application/json" -H @"$TMP/cabecalho" --data-binary @"$TMP/corpo")" || {
  echo "Não foi possível falar com a Hinova (rede ou endereço). Confira a internet e tente de novo." >&2; exit 1; }

# Lê só os campos esperados; nunca mostra o token do painel nem a senha
SALVAR="$SALVAR" STATUS="$STATUS" python3 - "$TMP/resposta" <<'PY'
import json, os, sys
status = os.environ["STATUS"]
try:
    dados = json.load(open(sys.argv[1], encoding="utf-8"))
except Exception:
    dados = None
token = dados.get("token_usuario") if isinstance(dados, dict) else None
if status.startswith("2") and isinstance(token, str) and token and not (isinstance(dados, dict) and dados.get("error")):
    print(f"\nOK: token_usuario gerado ({len(token)} caracteres).\n")
    destino = os.environ.get("SALVAR")
    if destino:
        caminho = os.path.expanduser(destino)
        fd = os.open(caminho, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w") as f:
            f.write(token + "\n")
        print(f"Gravado em {caminho} (só você lê). Apague o arquivo depois de usar.")
    else:
        print(token)
    print("\nPróximos passos:")
    print("  1. Easypanel > Environment: HINOVA_TOKEN=<o token acima> (sem aspas nem espaços) e HINOVA_AUTH=token; Deploy.")
    print("  2. Console do app: npm run testar-hinova -- SEUCPF (etapas 3 e 4 devem mostrar os boletos).")
    print("  3. Atualize o mesmo token no n8n.")
    print("  Não cole este token em conversas, e-mails ou no repositório.")
    sys.exit(0)

print(f"\nFALHOU (HTTP {status}).")
mensagens = []
if isinstance(dados, dict):
    for k in ("mensagem", "message", "error", "erro", "errors"):
        v = dados.get(k)
        if isinstance(v, list):
            mensagens += [str(x)[:200] for x in v[:5]]
        elif v:
            mensagens.append(str(v)[:200])
for m in mensagens:
    print(f"  Hinova: {m}")
texto = " ".join(mensagens).lower()
if "senha" in texto or "usu" in texto:
    print("  Dica: o usuário precisa estar ATIVO no SGA, ser da mesma associação do token do painel e a senha tem de ser a atual.")
if status == "401" or "token" in texto or "autoriz" in texto:
    print("  Dica: confira o token do painel (Gerenciar APIs): 'Permitir acesso' = SIM e o endpoint usuario/autenticar liberado.")
sys.exit(1)
PY
