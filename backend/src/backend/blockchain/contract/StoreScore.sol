// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract Score {

    struct Players {
        int256 id_user;
        uint256 Id_Tournament;
        string Round;
        string Name_Winner;
        uint8 Score_Winner;
        string Name_Losser;
        uint8 Score_Losser;
    }

    struct PlayersWithoutIdUser {
        uint256 Id_Tournament;
        string Round;
        string Name_Winner;
        uint8 Score_Winner;
        string Name_Losser;
        uint8 Score_Losser;
    }

    address private owner;
    uint private CurrentIdTournament;
    bool private isTournamentActive;
    int256 private activeUser;
    mapping(uint => Players[]) private StoreTournament;
    uint256 private TournamentStartTime;
    uint256 private constant Tournament_TimeOut = 240;

    constructor() {
        owner = msg.sender;
        CurrentIdTournament = 0;
        isTournamentActive = false;
        activeUser = -1;
        TournamentStartTime = 0;
    }

    modifier Only_Owner() {
        require(msg.sender == owner, "Sorry, you can't add any value");
        _;
    }

    function Get_balance() public view returns (uint256) {
        return (address(owner).balance);
    }

    function Get_Current_Id_Tournament() public view returns (uint) {
        return (CurrentIdTournament);
    }

    function Is_Tournament_Active() public view returns (bool) {
        if (isTournamentActive && block.timestamp > TournamentStartTime + Tournament_TimeOut)
            return (false);
        return (isTournamentActive);
    }

    function Is_Tournament_Timed_Out() public view returns (bool) {
        return (isTournamentActive && block.timestamp > TournamentStartTime + Tournament_TimeOut);
    }

    function Get_Tournament_Time_Left() public view returns (uint256) {
        if (!isTournamentActive)
            return (0);
        uint256 endTime = TournamentStartTime + Tournament_TimeOut;
        if (block.timestamp >= endTime)
            return (0);
        return (endTime - block.timestamp);
    }

    function Get_Active_User() public view returns (int256) {
        if (Is_Tournament_Active())
            return (activeUser);
        else
            return (-1);
    }

    function _resetIfTimedOut() private {
        if (isTournamentActive && block.timestamp > TournamentStartTime + Tournament_TimeOut) {
            isTournamentActive = false;
            activeUser = -1;
        }
    }

    function Start_Tournament(int256 Id_User) public Only_Owner {
        _resetIfTimedOut();
        require(!isTournamentActive, "Tournament is already active.");
        isTournamentActive = true;
        activeUser = Id_User;
        TournamentStartTime = block.timestamp;
    }

    function Set_Score(int256 Id_User, string memory RD, string memory NW, uint8 SW, string memory NL, uint8 SL) public Only_Owner {
        _resetIfTimedOut();
        require(isTournamentActive, "No active tournament. Start a tournament first.");
        require(Id_User == activeUser, "You are not the current tournament player.");
        StoreTournament[CurrentIdTournament].push(Players({
            id_user: Id_User,
            Id_Tournament: CurrentIdTournament,
            Round: RD,
            Name_Winner: NW,
            Score_Winner: SW,
            Name_Losser: NL,
            Score_Losser: SL
        }));
        TournamentStartTime = block.timestamp;
        if (keccak256(abi.encodePacked(RD)) == keccak256(abi.encodePacked("final"))) {
            isTournamentActive = false;
            CurrentIdTournament++;
            activeUser = -1;
        }
    }

    function Delete_Score(uint256 Id_Tournament) public Only_Owner() {
        isTournamentActive = false;
        activeUser = -1;
        delete (StoreTournament[Id_Tournament]);
    }

    function Cancel_Tournament() public Only_Owner() {
        isTournamentActive = false;
        activeUser = -1;
    }

    function Get_AllScore() public view returns (PlayersWithoutIdUser[] memory) {
        uint totalMatches = 0;
        
        for (uint i = 0; i <= CurrentIdTournament; i++) {
            uint matchCount = StoreTournament[i].length;
            if (matchCount >= 3 && keccak256(abi.encodePacked(StoreTournament[i][matchCount - 1].Round)) == keccak256(abi.encodePacked("final"))) {
                totalMatches += 3;
            }
        }
        if (totalMatches == 0)
            return (new PlayersWithoutIdUser[](0));
        PlayersWithoutIdUser[] memory allPlayers = new PlayersWithoutIdUser[](totalMatches);
        uint index = 0;
        for (uint i = 0; i <= CurrentIdTournament; i++) {
            uint matchCount = StoreTournament[i].length;
            if (matchCount >= 3 && keccak256(abi.encodePacked(StoreTournament[i][matchCount - 1].Round)) == keccak256(abi.encodePacked("final"))) {
                uint startIdx = matchCount - 3;
                for (uint j = startIdx; j < matchCount; j++) {
                    Players memory player = StoreTournament[i][j];
                    allPlayers[index] = PlayersWithoutIdUser({
                        Id_Tournament: player.Id_Tournament,
                        Round: player.Round,
                        Name_Winner: player.Name_Winner,
                        Score_Winner: player.Score_Winner,
                        Name_Losser: player.Name_Losser,
                        Score_Losser: player.Score_Losser
                    });
                    index++;
                }
            }
        }
        return (allPlayers);
    }
}