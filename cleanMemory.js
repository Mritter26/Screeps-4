/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('cleanMemory'); // -> 'a thing'
 */
 
 function cleanMemory()
 {
    if((Game.spawns.length == 0) && (Game.creeps.length == 0))
    {
        Game.notify('All spawns and creeps were destroyed, cleaning memory for new spawn', 10);
        console.log('All spawns and creeps were destroyed, cleaning memory for new spawn');
		
        removeCreeps();
		
        for(var i in Memory.spawns)
		{
            if(!Game.spawns[i])
			{
                delete Memory.spawns[i];
            }
        }
		
        for(var i in Memory.rooms)
		{
            if(!Game.rooms[i])
			{
                delete Memory.rooms[i];
            }
        }
		
		removeFlags();
    }
 }
 
 function removeFlags()
 {
    for(var i in Memory.flags)
	{
        delete Memory.flags[i];
    }
    for(var x in Game.flags)
    {
        Game.flags[x].remove();
    }
    for(var y in Game.creeps)
    {
		var unit = Game.creeps[i];
		//returns null, not sure how to reference additional information inside these
        if(unit != null)
		{
			delete unit.memory.direction;
		}
    }
 }
 
 //When construction is complete it leaves flags behind to the old now-invalid
 //id. Use this to remove all of these non-relevant flags when construction
 //is completed.
 function removeFlagsWithId(removeId)
 {
	//Remove all the physical matching flags first and then clean up the associated memory.
	for(var x in Game.flags)
    {
		if(Game.flags[x].memory.usingDestinationId == removeId)
		{
			Game.flags[x].remove();
		}
    }
	 
    for(var i in Memory.flags)
	{
		if(Memory.flags[i].usingDestinationId == removeId)
		{
			delete Memory.flags[i];
		}
    }

 }
 
 function removeFlagsWithoutSource(room)
 {
	var sources = room.find(FIND_SOURCES);
	var reset;
	var lastId;
	for(var y in Memory.flags)
	{
		//Skip flags we've already processed/deleted
		if(lastId == Memory.flags[y].usingDestinationId)
		{
			continue;
		}
		
		reset = false;
		for(var x in sources)
		{
			if(Memory.flags[y].usingDestinationId == null)
			{
				reset = true;
				break;
			}
			else if(Memory.flags[y].usingDestinationId != null && 
				Memory.flags[y].usingDestinationId == sources[x].id)
			{
				reset = true;
				break;
			}
			//console.log(x + ' source id: ' + sources[x].id + ' of ' + sources.length);
		}
		
		if(reset == false && Memory.flags[y].usingDestinationId != null)
		{
			lastId = Memory.flags[y].usingDestinationId;
			console.log('removing flags with id: ' + Memory.flags[y].usingDestinationId);
			removeFlagsWithId(Memory.flags[y].usingDestinationId);
			//break;
		}
	}
 }
 
 function removeCreeps()
 {
    for(var i in Memory.creeps)
	{
        delete Memory.creeps[i];
    }
    for(var x in Game.creeps)
    {
        Game.creeps[x].suicide();
    }
 }
 
 function removeRole(role)
 {
	//Suicide all relevant units with this role, then go through memory and clean that out
	for(var x in Game.creeps)
	{
		var unit = Game.creeps[x];
		if(unit.memory.role == role)
		{
			unit.suicide();
		}
	}
	 
	for(var y in Memory.creeps)
	{
		if(Memory.creeps[y].role == role || Memory.creeps[y] == null || Memory.creeps[y].role == null)
		{
			delete Memory.creeps[y];
		}
	}
 }
 
 //Other then the flags we remove all evidence that scouts ever existed.
 //Predominantly used for clean up when scouting fails during implementation/testing
 //Use in conjuncture with removeFlagsWithId(removeId) to remove offending flags
 function removeScoutInfo()
 {
	//Remove elements inside rooms that relate to scouts
	for(var x in Memory.rooms)
	{
		if(Memory.rooms[x].exitMax != null)
		{
			delete Memory.rooms[x].exitsVisited;
			delete Memory.rooms[x].exitMax;
			delete Memory.rooms[x].sources;
			//delete Memory.rooms[x].owner;
			//delete Memory.rooms[x].threat;
		}
	}
	
	//Remove the creeps and associated memory of scouts
	removeRole('scout');
	
	//Remove elements inside spawns that relate to scouts
	for(var y in Memory.spawns)
	{
		delete Memory.spawns[y].harvestId0;
		delete Memory.spawns[y].harvestId1;
		delete Memory.spawns[y].harvestId2;
		delete Memory.spawns[y].harvestId3;
		
		delete Memory.spawns[y].needGather0;
		delete Memory.spawns[y].needGather1;
		delete Memory.spawns[y].needGather2;
		delete Memory.spawns[y].needGather3;
		
		delete Memory.spawns[y].needHarvest0;
		delete Memory.spawns[y].needHarvest1;
		delete Memory.spawns[y].needHarvest2;
		delete Memory.spawns[y].needHarvest3;
		
		delete Memory.spawns[y].requestScout;
		
		delete Memory.spawns[y].consecutiveReady;
		delete Memory.spawns[y].scoutsAlive;
	}
 }
 
 module.exports = function()
 {
	cleanMemory();
 }
 
 module.exports.purgeFlags = function()
 {
    removeFlags();
 }
 
 module.exports.purgeCreeps = function()
 {
    removeCreeps();
 }
 
 module.exports.purgeRole = function(role)
 {
    removeRole(role);
 }
 
 module.exports.purgeFlagsWithId = function(removeId)
 {
	removeFlagsWithId(removeId);
 }
 
 module.exports.purgeFlagsWithoutSource = function(room)
 {
	//Has a bug where FIND_SOURCES only finds active (non completely harvested energy) sources
	//removeFlagsWithoutSource(room);
 }
 
 module.exports.purgeScoutInfo = function()
 {
	removeScoutInfo();
 }