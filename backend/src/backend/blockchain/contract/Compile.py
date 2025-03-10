import marshal
from solcx import install_solc, set_solc_version, compile_files

install_solc("0.8.28")
set_solc_version("0.8.28")

compiled_sol = compile_files(['/backend/blockchain/contract/StoreScore.sol'], output_values=['abi', 'bin'])

contract_id = list(compiled_sol.keys())[0]
contract_interface = compiled_sol[contract_id]

bytecode = contract_interface['bin']
abi = contract_interface['abi']

Save_Variable = {
                    "abi": abi,
                    "bytecode": bytecode
                }

with open("/backend/blockchain/contract/Compile_file", "wb") as f:
    marshal.dump(Save_Variable, f)
    f.close()

print("Compile is Done")