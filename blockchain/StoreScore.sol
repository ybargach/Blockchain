// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract Score {

    struct Players {
        uint256 Id_Tournament;
        string  Round;
        string  Name_Winner;
        uint8   Score_Winner;
        string  Name_Losser;
        uint8   Score_Losser;
    }

    address private owner;
    uint private CurrentIdTournament;
    mapping(uint => Players[]) StoreTournament;

    constructor() {
        owner = msg.sender;
        CurrentIdTournament = 0;
    }

    modifier Only_Owner {
        require(msg.sender == owner, "Sorry you can't Add any value");
        _;
    }

    function Get_balance() public view returns (uint256) {
        return (address(owner).balance);
    }

    function Get_Current_Id_Tournament() public view returns (uint) {
        return (CurrentIdTournament);
    }

    function Set_Score(string memory RD, string memory NW, uint8 SW, string memory NL, uint8 SL) public Only_Owner() {
        StoreTournament[CurrentIdTournament].push(Players({
            Id_Tournament: CurrentIdTournament,
            Round: RD,
            Name_Winner: NW,
            Score_Winner: SW,
            Name_Losser: NL,
            Score_Losser: SL
        }));
        if (keccak256(abi.encodePacked((RD))) == keccak256(abi.encodePacked(("Final"))))
            CurrentIdTournament++;
    }

    function Get_AllScore() public view returns (Players[] memory) {
        uint totalMatches = 0;
        for (uint i = 0; i <= CurrentIdTournament; i++) {
            totalMatches += StoreTournament[i].length;
        }
        Players[] memory allPlayers = new Players[](totalMatches);
        uint index = 0;
        for (uint i = 0; i <= CurrentIdTournament; i++) {
            for (uint j = 0; j < StoreTournament[i].length; j++) {
                allPlayers[index] = StoreTournament[i][j];
                index++;
            }
        }
        return allPlayers;
    }
}