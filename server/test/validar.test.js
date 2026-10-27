import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarPlaca, normalizarCpf, validarPedido, mascararCpf, mascararTelefone, mascararPlaca, finalPlaca } from "../lib/validar.js";

test("placa: aceita antiga e Mercosul, com ou sem hífen e minúsculas", () => {
  assert.equal(normalizarPlaca("ABC1234"), "ABC1234");
  assert.equal(normalizarPlaca("abc-1d23"), "ABC1D23");
  assert.equal(normalizarPlaca(" ABC 1D23 "), "ABC1D23");
});

test("placa: recusa tentativas de injeção e formatos inválidos", () => {
  for (const v of ["ABC1D23' OR '1'='1", "ABC1D2;", "AB1D234", "ABCD123", "ABC1D2", "ÁBC1D23", "ABC1D23--", "", null, 123, ["ABC1D23"], { a: 1 }]) {
    assert.equal(normalizarPlaca(v), null, `deveria recusar ${JSON.stringify(v)}`);
  }
});

test("CPF: aceita válido com e sem máscara", () => {
  assert.equal(normalizarCpf("529.982.247-25"), "52998224725");
  assert.equal(normalizarCpf("52998224725"), "52998224725");
});

test("CPF: recusa dígito verificador errado, repetidos e caracteres estranhos", () => {
  for (const v of ["529.982.247-24", "00000000000", "111.111.111-11", "5299822472", "52998224725' --", "52998224725 OR 1=1", "529 982 247 25", null, 52998224725]) {
    assert.equal(normalizarCpf(v), null, `deveria recusar ${JSON.stringify(v)}`);
  }
});

test("pedido: exige os três campos e recusa campos extras", () => {
  assert.deepEqual(validarPedido({ placa: "ABC1D23", cpf: "529.982.247-25", token: "t" }), { placa: "ABC1D23", cpf: "52998224725", token: "t" });
  assert.equal(validarPedido({ placa: "ABC1D23", cpf: "529.982.247-25", token: "t", admin: true }).erro, "campos");
  assert.equal(validarPedido({ placa: "ABC1D23", cpf: "529.982.247-25" }).erro, "token");
  assert.equal(validarPedido([]).erro, "corpo");
  assert.equal(validarPedido({ placa: "ABC1D23", cpf: "529.982.247-25", token: "x".repeat(2049) }).erro, "token");
});

test("pedido sem placa: busca só por CPF; placa preenchida continua validada", () => {
  assert.deepEqual(validarPedido({ cpf: "529.982.247-25", token: "t" }), { placa: null, cpf: "52998224725", token: "t" });
  assert.deepEqual(validarPedido({ placa: "", cpf: "529.982.247-25", token: "t" }), { placa: null, cpf: "52998224725", token: "t" });
  for (const placa of ["   ", "ABC", 0, false, [], { $ne: null }, "ABC1D23' OR '1'='1"]) {
    assert.equal(validarPedido({ placa, cpf: "529.982.247-25", token: "t" }).erro, "placa", JSON.stringify(placa));
  }
  assert.equal(validarPedido({ token: "t" }).erro, "cpf", "CPF continua obrigatório");
});

test("máscaras não expõem CPF nem telefone completos", () => {
  assert.equal(mascararCpf("52998224725"), "***.***.*47-25");
  assert.equal(mascararTelefone("5511987654321"), "(**) *****-4321");
  assert.equal(mascararPlaca("ABC1D23"), "ABC****");
  assert.equal(mascararPlaca(null), "(só CPF)");
  assert.equal(finalPlaca("abc-1d23"), "1D23");
});
