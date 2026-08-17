export const canonicalPlayers = [
  {playerId:'PV-QB',name:'Alex Quarter',jersey:'4'},
  {playerId:'PV-DB',name:'Taylor Return',jersey:'4'},
  {playerId:'PV-RB',name:'Riley Runner',jersey:'20'},
];

const empty = () => ({Values:[]});
export const historicalStructure = {
  Game:{Type:'FootballGame',HasStarted:true,IsComplete:true,Date:'11/22/2025',HomeTeam:{Name:'Prairie View'},VisitingTeam:{Name:'Valley'}},
  Stats:{HomeTeam:{Players:[
    {Team:'HomeTeam',FirstName:'Alex',LastName:'Quarter',UniformNumber:'4',PersonId:''},
    {Team:'HomeTeam',FirstName:'Taylor',LastName:'Return',UniformNumber:'4',PersonId:''},
    {Team:'HomeTeam',FirstName:'Riley',LastName:'Runner',UniformNumber:'20',PersonId:''},
  ],PlayerGroups:{
    Rushing:{Values:[{Uni:'20',Name:'R. RUNNER',RushingAttempts:'8',RushingNetYards:'71',RushingTouchdowns:'2'}]},
    Receiving:{Values:[{Uni:'20',Name:'R. RUNNER',ReceivingReceptions:'3',ReceivingYards:'25',ReceivingTouchdowns:'1'}]},
    Passing:{Values:[{Uni:'4',Name:'A. QUARTER',PassIntercepted:'1'}]},
    Fumbles:{Values:[{Uni:'20',Name:'R. RUNNER',FumblesFumbles:'2',FumblesLost:'1'}]},
    Tackling:{Values:[{Uni:'4',Name:'T. RETURN',TotalTackles:'6',UnassistedTacklesForLoss:'1',AssistedTacklesForLoss:'1',TacklesForLossYards:'8'}]},
    Sacks:{Values:[{Uni:'4',Name:'T. RETURN',TotalSacks:'1.0',SackYardsForLossYards:'5',HurriedQb:'2'}]},
    PassDefense:{Values:[{Uni:'4',Name:'T. RETURN',BrokenPass:'3',Interceptions:'1',InterceptionsYards:'33'}]},
    Interceptions:{Values:[{Uni:'4',Name:'T. RETURN',InterceptionReturnReturns:'1',InterceptionReturnYards:'33',InterceptionReturnTouchdowns:'1'}]},
    KickReturns:{Values:[{Uni:'20',Name:'R. RUNNER',KickoffReturnTouchdowns:'1'}]},
    PuntReturns:{Values:[{Uni:'4',Name:'T. RETURN',PuntReturnTouchdowns:'1'}]},
    FumbleReturns:empty(),
  }},VisitingTeam:{Players:[],PlayerGroups:{}}},Plays:[],
};
