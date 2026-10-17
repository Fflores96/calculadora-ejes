# Arma ti-nspire/ejes.py = nucleo/ejes.py (el mismo codigo probado por
# nucleo/pruebas.py) + ti-nspire/interfaz.py. Correr tras cada cambio:
#   python ti-nspire/construir.py
import os

aqui = os.path.dirname(os.path.abspath(__file__))
nucleo = open(os.path.join(aqui, "..", "nucleo", "ejes.py"), encoding="utf-8").read()
interfaz = open(os.path.join(aqui, "interfaz.py"), encoding="utf-8").read()
salida = os.path.join(aqui, "ejes.py")
with open(salida, "w", encoding="utf-8", newline="\n") as f:
    f.write(nucleo.rstrip() + "\n\n" + interfaz.lstrip("\n"))
print("ok:", salida, sum(1 for _ in open(salida, encoding="utf-8")), "lineas")
