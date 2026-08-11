"""
Cadastra um novo usuário/login no sistema AZ Elétrica via API.

Uso:
    pip install requests
    python cadastrar_login.py
"""

import requests

BASE_URL = "https://web-production-a606c.up.railway.app"


def main():
    print("=== Cadastrar novo login no AZ Elétrica ===\n")
    nome = input("Nome: ").strip()
    email = input("E-mail (será seu usuário de login): ").strip()
    senha = input("Senha: ").strip()

    r = requests.post(
        f"{BASE_URL}/auth/registro",
        json={"nome": nome, "email": email, "senha": senha},
    )

    if r.status_code == 200:
        data = r.json()
        print(f"\nCadastrado com sucesso!")
        print(f"  Nome:  {data['usuario']['nome']}")
        print(f"  Email: {data['usuario']['email']}")
        print(f"  ID:    {data['usuario']['id']}")
        print(f"\nJá pode entrar no sistema com esse e-mail e senha.")
    elif r.status_code == 400:
        print(f"\nErro: {r.json().get('detail', 'esse e-mail já está cadastrado')}")
    else:
        print(f"\nErro inesperado ({r.status_code}): {r.text}")


if __name__ == "__main__":
    main()
