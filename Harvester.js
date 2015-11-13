/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('Harvester'); // -> 'a thing'
 */
 
 var viewFlags = require('previewRoute');
 var followFlagForward = require('createPathFlags');
 
 //TO DO: Use the spawn that this unit came from. This currently just sends back the first
 //spawn that is in the same room as the unit.
 function findSpawn(unit)
 {
	var useSpawn;
	if(unit.memory.spawnID != null)
	{
		useSpawn = Game.getObjectById(unit.memory.spawnID);	//A spawn this unit can dump resources to
	}
	else
	{
		for(var x in Game.spawns)
		{
			if(unit.room.name == Game.spawns[x].room.name)
			{
				useSpawn = Game.spawns[x].id
				unit.memory.spawnID = useSpawn;
			}
		}
	}
	return(useSpawn);
 }
 
 //Reassign the unit to be role = 'to' with the flags To and From created.
 //This will clear and create the first route and move automatically to
 //use ressignFrom
 function reassignTo(unit)
 {
    if(Game.flags.To != null && Game.flags.From != null )
    {
        //This clears (and thus needs to recreate) a new path
        unit.memory.pathTo = null;
        saveAndPathToNew(unit, Game.flags.From.pos, Game.flags.To.pos);
        unit.memory.role = 'from';
        viewFlags(unit);
    }
 }
 
 //Let reassignTo use this, don't call directly. Clears the pathFrom and assigns
 //it a new one, gives the new 'idle' role once complete.
 function reassignFrom(unit)
 {
    if(Game.flags.From != null && Game.flags.To != null)
    {
        //This clears (and thus needs to recreate) a new path
        unit.memory.pathFrom = null;
        saveAndPathFromNew(unit, Game.flags.From.pos, Game.flags.To.pos);
        unit.memory.role = 'idle';
        viewFlags(unit);
    }
 }
 
 function moveToFlag(unit)
 {
     if(Game.flags.Flag1 != null)
     {
        unit.moveTo(Game.flags.Flag1);
     }
 }
 
 //Axillary function, return unit to closest spawn, will have to manually mess with
 //memory by hand from there to reassign.
 function reassignJob(unit)
 {
    if(unit.memory.role != 'idle')
    {
        unit.memory.role = 'idle';
    }
    
    var target = unit.pos.findInRange(FIND_MY_SPAWNS, 1)
    if(target != null)
    {
        //unit.say('Del Mem');
        unit.memory.role = 'idle';  //Perhaps change to something else
    }
    else
    {
        var returnTo = unit.pos.findClosestByRange(FIND_MY_SPAWNS);
        if(returnTo != null)
        {
            unit.moveTo(returnTo.x, returnTo.y);
        }
    }
 }
 
 //This function runs by retrieving which spot is our next 'need to fill this with a
 //harvester' spot which we retrieve with increaseHarvestSpot by saving how many harvesters
 //we've assigned already. We then proceed look at all relevant spots in always the same
 //order in this room, knowing that once we find the spot that matches how many harvesters
 //we've placed +1 this spot needs a harvestor and other code places that harvestor there.
 //Repeatedly this will fill up the first source first and then fill all other sources where
 //possible. maxPerEnergy should equal neededHarvestPerSec/unitHarvestCapability, rounded up.
 //On the base game the energy respawns every 300 seconds, so at 3000 max energy 
 //this is 10/unitHarvestCapability
 //Return the source we'll be using from here on out.
 function getEnergyHarvestLoc(unit, sources)
 {
	var spawnInRoom = findSpawn(unit);
	if(unit.memory.harvestLocation == null && spawnInRoom != null &&
		(unit.memory.role == 'worker' || unit.memory.role == 'lazy'))
	{
		var currentEnergy;
		var currentRoom = unit.room;
		var stopAtSpot = increaseHarvestSpot(unit)-1;   //HavestSpot is saving the 'next' spot, so -1 to get current one
		var totalHarvestSpots = 0;
		for(var i = 0; i < sources.length; i++)
		{
			currentEnergy = sources[i];
			var countHarvestSpots = 0;
			var maxPerEnergy = 3;	//Allow this many harvesters at each energy node, no more
            //Search 1 spot away from the source and store applicable spots for harvest/gather
            for(var x = currentEnergy.pos.x - 1; x <= (currentEnergy.pos.x + 1) && countHarvestSpots < maxPerEnergy; x++)
            {
                for(var y = currentEnergy.pos.y - 1; y <= (currentEnergy.pos.y + 1) && countHarvestSpots < maxPerEnergy; y++)
                {
                    var lookAtRoomPosition = currentRoom.getPositionAt(x, y);
                    var terrain = lookAtRoomPosition.lookFor('terrain');
                    //Just avoiding walls should be enough, but plain's are ideal
                    if(terrain == 'plain' || terrain == 'swamp')
                    {
						if(totalHarvestSpots == stopAtSpot)
						{
							//Assumes harvester was just spawned after needGatherers = 0, otherwise
							//this should be += but this messes up the entire logic of harvester->gatherer*x
							//TO DO: Adjust according to what units we're currently spawning, formula is
							//Alternative Gatherer per Harvester= ROUND_UP((HarvestRate*(DistanceToNode*2))/CapacityPerGatherer)
							//getRangeTo is returning negative values, going to assume its still the range just 'behind', so Abs()'ing the value
							unit.room.memory.needGatherers = Math.abs(Math.ceil(4.0*2.0*(lookAtRoomPosition.findPathTo(spawnInRoom).length)/150.0));
							unit.memory.harvestLocation = lookAtRoomPosition;
							return(currentEnergy);
						}
                        countHarvestSpots++;
						totalHarvestSpots++;
                    }
                }
            }
		}
	}
	else
	{
		//Already populated or wrong role to get this information
		return(null);
	}
	//To many harvesters, most likely cause of this.
	//TO DO: Switch to building gathers, builders, or attackers
	//unit.suicide();
	console.log("couldn't find a place for this harvester");
	return(null);
 }
 
 //This does the same thing as the harvester by searching for a good spot for a harvester
 //that is being paired with this gatherer, then searches a 3x3 grid around that for gatherer
 //spot and places the gatherer there if it's a plain.
 //Assumes right now there is 1 gatherer for every 1 harvester, change logic if this changes
 function getEnergyPickupLoc(unit, sources)
 {
	if(unit.memory.gatherLocation == null && unit.memory.role == 'gather')
	{
		var currentEnergy;
		var currentRoom = unit.room;
		increaseGatherSpot(unit);
		var stopAtSpot = getHarvestSpot(unit)-1;	//HavestSpot is saving the 'next' spot, so -1 to get current one
		var totalHarvestSpots = 0;
		var harvestLocation;
		for(var i = 0; i < sources.length; i++)
		{
			currentEnergy = sources[i];
			var countHarvestSpots = 0;
			var maxPerEnergy = 3;	//Allow this many harvesters at each energy node, no more
            //Search 1 spot away from the source and store applicable spots for harvest/gather
            for(var x = currentEnergy.pos.x - 1; x <= (currentEnergy.pos.x + 1) && countHarvestSpots < maxPerEnergy; x++)
            {
                for(var y = currentEnergy.pos.y - 1; y <= (currentEnergy.pos.y + 1) && countHarvestSpots < maxPerEnergy; y++)
                {
                    var lookAtRoomPosition = currentRoom.getPositionAt(x, y);
                    //Just avoiding walls should be enough, but plain's are ideal
                    var terrain = lookAtRoomPosition.lookFor('terrain');
                    if(terrain == 'plain' || terrain == 'swamp')
                    {
						if(totalHarvestSpots == stopAtSpot)
						{
							//------------------------------------------------------
							//-------Found harvester spot we're pairing with--------
							//------------------------------------------------------
							harvestLocation = lookAtRoomPosition;
							for(var x2 = harvestLocation.x-1; x2 <= (harvestLocation.x + 1); x2++)
							{
								for(var y2 = harvestLocation.y-1; y2 <= (harvestLocation.y + 1); y2++)
								{
									//Don't consider the center as a potential spot, this is where the harvester is
									//Also make sure this is 2 away from the source so the gathers don't get stuck
									if(x2 != harvestLocation.x || y2 != harvestLocation.y)
									{
										var gatherPosition = currentRoom.getPositionAt(x2, y2);
										if(currentEnergy.pos.getRangeTo(gatherPosition.x,gatherPosition.y) < 0)
											console.log('range returned negative: ' + currentEnergy.pos.getRangeTo(gatherPosition.x,gatherPosition.y) + ' pos1: ' + currentEnergy.pos + ' pos2: ' + gatherPosition.x + ', ' + gatherPosition.y);
										//Just avoiding walls should be enough, but plain's are ideal
										var terrain = gatherPosition.lookFor('terrain');
										if((terrain == 'plain' || terrain == 'swamp') &&
									        Math.abs(currentEnergy.pos.getRangeTo(gatherPosition.x,gatherPosition.y)) == 2)
										{
											unit.memory.currentGatherSpot = gatherPosition;
											return(currentEnergy);
										}
									}
								}
							}
							console.log(unit + " never found a gatherer spot, this will cause an issue");
							return(currentEnergy);
						}
                        countHarvestSpots++;
						totalHarvestSpots++;
                    }
                }
            }
		}
	}
	else
	{
		//Already populated or wrong role to get this information
		return(null);
	}
	//To many harvesters, most likely cause of this.
	//TO DO: Switch to building gathers, builders, or attackers
	//unit.suicide();
	console.log("couldn't find a place for this gatherer");
	return(null);
 }
 
 function retrieveSource(unit)
 {
    var activeSource;
    //Record in the worker what source he's working at for using later
    //no need to check for all the sources every frame if we can just retrieve it
    if(unit.memory.usingSourceId)
    {
        activeSource = Game.getObjectById(unit.memory.usingSourceId);
    }
    else
    {
        var sources = unit.room.find(FIND_SOURCES);
		activeSource = getEnergyHarvestLoc(unit, sources);
		if(activeSource == null)
		{
			activeSource = getEnergyPickupLoc(unit, sources);
		}
		if(activeSource != null)
		{
			unit.memory.usingSourceId = activeSource.id;
		}
        var storeId = unit.memory.usingSourceId;

        //Since we've captured this data already, we should record (if not already)
        //the maxSources in the room so we can use it later.
        if(!unit.room.memory.maxSources)
        {
            unit.room.memory.maxSources = Object.keys(sources).length;
        }
    }
    return(activeSource);
 }
 
 //CAUTION: Make sure the flags to move the harvesters into position have at least 1 flag, 1 away from the harvesters, if the
 //harvesters need to return, they'll look for this flag and use it to head back.
 function autoWorker(unit)
 {
    if(!unit.spawning && unit.memory.role == 'worker')
    {
        var activeSource;
        var saveAtSpawn = findSpawn(unit);
        if((unit.carry.energy < unit.carryCapacity || unit.carryCapacity == 0) && saveAtSpawn != null)
        {
            //Harvest by finding based on ID if activeSource == null
            if(unit.memory.usingSourceId != null)
    		{
    		    activeSource = Game.getObjectById(unit.memory.usingSourceId);
    		}
			else
			{
				activeSource = retrieveSource(unit);
			}
            
			var harvestError = unit.harvest(activeSource);
			if(harvestError == ERR_NOT_IN_RANGE)	//-9
			{
				if(unit.memory.pathTo != null)
				{
					//The paths to the energy sources will stop 2 spaces away from the energy sources for the gatherers
					//to pick up what they need. When they only need to move 1 more space to be in position, manually move
					//them that last spot.
					if(Math.abs(unit.pos.getRangeTo(activeSource)) == 2)
					{
						if(unit.moveTo(activeSource) == 0)
						{
							delete unit.memory.direction;	//Got to where we need, remove the direction, it's no longer valid.
						}
					}
					else
					{
						followFlagForward(unit, unit.carry.energy < unit.carryCapacity || unit.carryCapacity == 0);
					}
				}
				else
				{
					saveAndPathToNew(unit, saveAtSpawn.pos, unit.memory.harvestLocation);
				}
			}
        }
        else if(saveAtSpawn != null)
        {
            if(unit.memory.pathTo != null)
            {
				//The unit is full so move in reverse back towards the spawn for drop-off
				followFlagForward(unit, unit.carry.energy < unit.carryCapacity);
                //saveAndPathFrom(unit, unit.memory.pathTo[0]);
            }
        	//unit.moveTo(saveAtSpawn);
        	unit.transferEnergy(saveAtSpawn);
        }
    }
 }
 
 function saveAndPathToNew(unit, positionStart, positionEnd)
 {
    if(!unit.memory.pathTo)
    {
        if(positionEnd != null)
        {
            unit.memory.pathTo = positionStart.findPathTo(positionEnd.x, positionEnd.y, {maxOps: 2000});
            return(unit.moveTo(unit.memory.pathTo[0].x, unit.memory.pathTo[0].y));
        }
    }
    //No need to move if you're already at the destination
    else if(unit.pos.isEqualTo(positionEnd) == false)
    {
        var errors = unit.moveByPath(unit.memory.pathTo);
        //The storing and using moveByPath code looks for a path once and uses it until completion.
        //the begginings/ends of these paths don't always line up and so we use expensive moveTo
        //when it gets off track since it won't be using it for very long it's not a concern.
        if(errors == -5)
        {
            var error1 = unit.moveTo(positionStart.x, positionStart.y);
            var error2 = unit.moveTo(positionEnd.x, positionEnd.y);
            if( error1 != 0 && error2 != 0)
            {
                unit.say(errors);
            }
        }
        //If can't move, try to go around it, ignore if lost move part or if 'tired'
        else if(errors > -10 && errors != 0)
        {
            var error3 = unit.moveTo(positionStart.x, positionStart.y);
            var error4 = unit.moveTo(positionEnd.x, positionEnd.y);
            if(error3 != 0 && error4 != 0)
            {
                unit.say(errors);
            }
        }
        return(errors);
    }
    return(0);
 }
 
 //Attempting to use this to send in a unit, tell it to go somewhere and have that route saved under 'saveAt' for reuse later
 //Use this in all the other function, tired if rewriting it each time.
 function saveAndPathTo(unit, position)
 {
    return(saveAndPathToNew(unit, unit.pos, position));
 }
 
 function saveAndPathFromNew(unit, positionStart, positionEnd)
 {
    if(!unit.memory.pathFrom)
    {
        if(positionEnd != null && positionStart != null)
        {
            unit.memory.pathFrom = positionStart.findPathTo(positionEnd.x, positionEnd.y, {maxOps: 2000});
            return(unit.moveTo(unit.memory.pathFrom[0].x, unit.memory.pathFrom[0].y));
        }
    }
    //No need to move if you're already at the destination
    else if(unit.pos.isEqualTo(positionEnd) == false)
    {
        var errors = unit.moveByPath(unit.memory.pathFrom);
        //The storing and using moveByPath code looks for a path once and uses it until completion.
        //the begginings/ends of these paths don't always line up and so we use expensive moveTo
        //when it gets off track since it won't be using it for very long it's not a concern.
        if(errors == -5)
        {
            var error1 = unit.moveTo(positionStart.x, positionStart.y);
            var error2 = unit.moveTo(positionEnd.x, positionEnd.y);
            if( error1 != 0 && error2 != 0)
            {
                unit.say(errors);
            }
        }
        //If can't move, try to go around it, ignore if lost move part or if 'tired'
        else if(errors > -10 && errors != 0)
        {
            var error3 = unit.moveTo(positionStart.x, positionStart.y);
            var error4 = unit.moveTo(positionEnd.x, positionEnd.y);
            if(error3 != 0 && error4 != 0)
            {
                unit.say(errors);
            }
        }
        return(errors);
    }
    return(0);
 }
 
 function saveAndPathFrom(unit, position)
 {
    return(saveAndPathFromNew(unit, unit.pos, position));
 }
 
 function lazyWorkerFindSource(unit)
 {
	var saveAtSpawn = findSpawn(unit);
    if(unit.memory.role == 'worker' && saveAtSpawn != null)
    {
        var activeSource;
        if(unit.getActiveBodyparts(CARRY) == 0 || unit.carry.energy < unit.carryCapacity)
        {
			//Harvest by finding based on ID if activeSource == null
			if(unit.memory.usingSourceId != null)
    		{
    		    activeSource = Game.getObjectById(unit.memory.usingSourceId);
    		}
			else
			{
				activeSource = retrieveSource(unit);
			}
			
			var harvestSpot = unit.memory.harvestLocation;
			//TO DO: Investigate how activeSource can be null here
			if(harvestSpot == null && activeSource != null)
			{
				harvestSpot = activeSource.pos;
			}
			
			if(unit.pos.isEqualTo(harvestSpot) == false)
			{
				var harvestError = unit.harvest(activeSource);
                if(harvestError == 0)
                {
                    unit.memory.role = 'lazy';
                }
                else
                {
					if(unit.memory.pathTo != null)
					{
					    //console.log(unit.pos.getRangeTo(activeSource));
						//The paths to the energy sources will stop 2 spaces away from the energy sources for the gatherers
						//to pick up what they need. When they only need to move 1 more space to be in position, manually move
						//them that last spot.
						if(Math.abs(unit.pos.getRangeTo(activeSource)) <= 2)
						{	//If moveTo Location is farther range then before we don't actually want to delete direction
							//alternatively if we can keep progressing on our path we shouldn't need to delete direction either.
							if(unit.moveTo(activeSource) == 0)
							{
								delete unit.memory.direction;	//Got to where we need, remove the direction, it's no longer valid.
							}
						}
						else
						{
							//unit.moveTo(activeSource);
							followFlagForward(unit, unit.getActiveBodyparts(CARRY) == 0 || (unit.carry.energy < unit.carryCapacity));
						}
					}
					else 
					{
						saveAndPathToNew(unit, saveAtSpawn.pos, harvestSpot);
					}
				}
			}
        }
        else if(unit.transferEnergy(saveAtSpawn) == ERR_NOT_IN_RANGE)
        {
            unit.moveTo(saveAtSpawn);
        }
    }
 }
 
 function lazyHarvest(unit)
 {
    if(unit.memory.role == 'lazy')
    {
        var activeSource = retrieveSource(unit);

		//If we've capped out on energy, look around for a gather to drop off on and transfer
        if(unit.carry.energy == unit.carryCapacity)
        {
            var neighbors = unit.pos.findInRange(FIND_MY_CREEPS, 1);
			if(neighbors.length)
			{
				for(var i in neighbors)
				{
					if(neighbors[i].memory.role == 'gather')
					{
						if(unit.transferEnergy(neighbors[i]) == 0)
							break;
					}
				}
			}
        }
		//Harvest by finding based on ID if activeSource == null
		if(activeSource == null)
		{
		    activeSource = Game.getObjectById(unit.memory.usingSourceId);
		}
		//If can't harvest, assume need to become worker to get back to the spot.
		//ERR_INVALID_TARGET happens when targeting a source not in this room
		var harvestCode = unit.harvest(activeSource);
        if(harvestCode == ERR_NOT_IN_RANGE || harvestCode == ERR_INVALID_TARGET)
        {
            unit.memory.role = 'worker';
        }
		else if(harvestCode < 0 && harvestCode != -6)
		{
			//console.log(unit.name + ' can not harvest, harvest error code: ' + harvestCode);
		}
    }
 }
 
 function creepAtDirection(unit)
 {
    if(unit != null && unit.memory.direction != null)
    {
        var posX = unit.pos.x;
        var posY = unit.pos.y;
        if(unit.memory.direction == TOP)
        {
            posY++;
        }
        else if(unit.memory.direction == TOP_RIGHT)
        {
            posX++;
            posY++;
        }
        else if(unit.memory.direction == RIGHT)
        {
            posX++;
        }
        else if(unit.memory.direction == BOTTOM_RIGHT)
        {
            posX++;
            posY--;
        }
        else if(unit.memory.direction == BOTTOM)
        {
            posY--;
        }
        else if(unit.memory.direction == BOTTOM_LEFT)
        {
            posX--;
            posY--;
        }
        else if(unit.memory.direction == LEFT)
        {
            posX--;
        }
        else if(unit.memory.direction == TOP_LEFT)
        {
            posX--;
            posY++;
        }
        else
        {
            return(null);
        }
        
        return(unit.room.lookForAt('creep', posX, posY));
    }
 }
 
 //If unit we're passing in is full of energy, and we've found a unit with no energy, try to transfer to them
 function transferAround(unit)
 {
	for(var x = unit.pos.x+1; unit.carry.energy == unit.carryCapacity && x >= unit.pos.x-1; x--)
	{
		for(var y = unit.pos.y+1; y >= unit.pos.y-1; y--)
		{
			var unitAt = unit.room.lookForAt('creep', x, y);
			if(unitAt != null && unitAt[0] != null && unitAt[0].carry.energy == 0)
			{
				if(unit.transferEnergy(unitAt[0]) == 0)
					return(true);
			}
		}
	}
	return(false);
 }
 
 //Similar to the builder's buildRoad() in that it looks for a road underneath the gather and if none exists creates it.
 //Runs right before gatherers move along their task. Searches for a existing road and a construction site for a road
 //under the gatherer, if none exists the unit creates one for the builders to get to later.
 function findRoadOrCreate(unit)
 {
	var findStructure = unit.pos.lookFor('structure');
	for(var x = 0; findStructure != null && x < findStructure.length; x++)
	{
		if(findStructure[x].structureType == STRUCTURE_ROAD)
		{
			return(true);
		}
	}

	var findConstruction = unit.pos.lookFor('constructionSite');
	for(var y = 0; findConstruction != null && y < findConstruction.length; y++)
	{
		if(findConstruction[y].structureType == STRUCTURE_ROAD)
		{
			return(true);	//Road is already being built, ignore
		}
	}

	//We searched through all structures at this spot, no road was found, so build one.
	if(unit.pos.createConstructionSite(STRUCTURE_ROAD) == 0)
	{
		return(true);
	}
	return(false);
 }
 
 function gatherFrom(unit)
 {
    var returnResources = findSpawn(unit);
	//Going to try to grab any energy the unit can and immediately try a drop off instead of waiting for it to fill up
	//since it seems like all energy sits in the gatherers if I wait until they are full.
    //if(unit.carry.energy < unit.carryCapacity)
	if(unit.carry.energy == 0 && returnResources != null)
    {
        var activeSource;
		//TO DO: GoTo by finding based on ID if activeSource == null
		if(unit.memory.usingSourceId != null)
		{
		    activeSource = Game.getObjectById(unit.memory.usingSourceId);
		}
		else
		{
			activeSource = retrieveSource(unit);
		}
		//Legacy code, creates a path that goes to creates pathTo which at the moment is more accurate then
		//the path created in followFlagForward, this is used in followFlagForward which helps for gatherers
		//made for the spawn room
		if(returnResources != null && unit.memory.currentGatherSpot != null && unit.memory.pathTo == null)
		{
			saveAndPathToNew(unit, returnResources.pos, unit.memory.currentGatherSpot);
		}
		else
		{
			findRoadOrCreate(unit);
			followFlagForward(unit, unit.carry.energy < unit.carryCapacity);
		}
		
		if(returnResources != null)
		{
            //unit.transferEnergy(returnResources);	//Only here if unit.carry.energy == 0 changes back to < unit.carryCapacity
		}
    }
    else if(returnResources != null)
    {
        //unit.say(unit.carry.energy + "/" + unit.carryCapacity);
        var transferEnergyReturn = unit.transferEnergy(returnResources);
		//If make it back to the drop off and its full go and fill up a extension instead, delete the direction so when it finishes
		//the drop off it finds the start of the path again and resumes the path.
		if(transferEnergyReturn == ERR_FULL || unit.memory.direction == null)
        {
            var transferTargets = unit.room.find(FIND_MY_STRUCTURES);
			var transferTarget;
			var transferRange = 999999;
			for(var drained in transferTargets)
			{
                if(transferTargets[drained].energy != null && 
					transferTargets[drained].energy < transferTargets[drained].energyCapacity)
    			{
					var transfer = unit.transferEnergy(transferTargets[drained]);
    				if(transfer == ERR_NOT_IN_RANGE)
					{
						var tempRange = unit.pos.getRangeTo(transferTargets[drained]);
						if(tempRange < transferRange)
						{
							transferRange = tempRange;
							transferTarget = transferTargets[drained];
							//console.log(unit.name + ' found new range: ' + transferRange + ' to ' + transferTargets[drained]);
						}
						
						if(unit.memory.direction != null)
						{
							//If you find a extension that needs energy, move to it. This takes you off the route the gatherer
							//was on, so delete the direction now so it will search for the beginning of the route afterwards.
							delete unit.memory.direction;
						}
    				}
					else if(transfer == 0)
					{
						transferTarget = null;
						break;
					}
    			}
				else if(transferTargets[drained].energy != null && 
					transferTargets[drained].energy < transferTargets[drained].energyCapacity && 
					Math.abs(unit.pos.getRangeTo(transferTargets[drained])) == 1 &&
					unit.transferEnergy(transferTargets[drained]) == 0)
				{	//Don't look for any more structures to transfer to, successfully filled one.
					transferTarget = null;
					break;
				}
			}
			if(transferTarget != null)
			{
				var cpu = Game.getUsedCpu();
				//unit.moveTo(transferTarget);
				unit.moveByPath(unit.pos.findPathTo(transferTarget), {maxOps: 100});
				cpu = Game.getUsedCpu()-cpu;
				//console.log(unit.name + ' moving to capacitor costs: ' + cpu);
			}
        }
        else if(transferEnergyReturn == ERR_NOT_IN_RANGE)
        {
			findRoadOrCreate(unit);
    	    followFlagForward(unit, unit.carry.energy < unit.carryCapacity);
    	    //When we move there is a chance someone is ahead of us that is blocking our path. unit.move doesn't detect
    	    //this however we can use the stored direction to check the position it's trying to move and if they're is a
    	    //unit that direction, transfer the energy if possible. This will hopefully fill the requirement of the unit
    	    //ahead of it and let it move along, otherwise the gatherer will be not full again and will go back to retreive
    	    //more energy
			if(unit.carry.energy == unit.carryCapacity)
			{
				var unitOnPath = null;//creepAtDirection(unit);
				if(unitOnPath != null && unitOnPath[0] != null && unitOnPath[0].carry.energy <= 0)
				{	//If transfer fails, attempt to transfer to all possible units in range
					if(unit.transferEnergy(unitOnPath[0] < 0))
					{
						//transferAround(unit);
					}
				}
				else	//Was unable to transfer to path
				{
					//transferAround(unit);
				}
			}
        }
    }
    
    if(unit.carry.energy < unit.carryCapacity)
    {
        var target = unit.pos.findInRange(FIND_DROPPED_ENERGY, 1);
        if(target.length > 0)
    	{
            unit.pickup(target[0]);
        }
    }
 }
 
 function getHarvestSpot(unit)
 {
    var thisRoom = unit.room;
	if(thisRoom.memory.currentHarvestSpot == null)
	{
		thisRoom.memory.currentHarvestSpot = 0;
	}
	return(thisRoom.memory.currentHarvestSpot);
 }
 
 function increaseHarvestSpot(unit)
 {
    var thisRoom = unit.room;
	if(thisRoom.memory.currentHarvestSpot == null)
	{
		thisRoom.memory.currentHarvestSpot = 0;
	}
	else
	{
		thisRoom.memory.currentHarvestSpot += 1;
	}
	return(thisRoom.memory.currentHarvestSpot);
 }
 
 function increaseGatherSpot(unit)
 {
    var thisRoom = unit.room;
	if(thisRoom.memory.currentGatherSpot == null)
	{
		thisRoom.memory.currentGatherSpot = 0;
	}
	else
	{
		thisRoom.memory.currentGatherSpot += 1;
	}
	return(thisRoom.memory.currentGatherSpot);
 }
 
 function increaseBuilders(unit)
 {
	var thisRoom = unit.room;
	if(thisRoom.memory.currentBuilders == null)
	{
		thisRoom.memory.currentBuilders = 0;
	}
	else
	{
		thisRoom.memory.currentBuilders += 1;
	}
	return(thisRoom.memory.currentBuilders);
 }
 
module.exports.work = function(unit, harvestersSeen)
{
	//TO DO: Refill builders from harvesters. Possible new unit role.
    if(unit.memory.role == 'worker')
    {
        if(Object.keys(Game.creeps).length < 2)
        {
            autoWorker(unit);              //Sends blindly to selected source (don't leave it on this mode)
        }
        else
        {
            lazyWorkerFindSource(unit);    //Switch to lazyWorker when the initial 2-3 harvesters are up.
        }
    }
    else if(unit.memory.role == 'lazy')
    {
        lazyHarvest(unit);
    }
}

module.exports.gather = function(unit, gatherersSeen)
{
	if(unit.memory.role == 'gather')
    {
        gatherFrom(unit);
        //customize the x,y position to be where they create a path, 
        //goto and sit, making continuous trips from their spawn 
        //location and this spot
    }
}
 
//module.exports = function(unit, harvestersSeen, gatherersSeen)
//{
//	if(unit.memory.role == 'idle')
//    {
//        reassignJob(unit);
//    }
//    else if(unit.memory.role == 'flag')
//    {
//        moveToFlag(unit);
//    }
//    else if(unit.memory.role == 'to' || unit.memory.role == 'To')
//    {
//        //Have flags 'To' and 'From' created, assigns 'idle' role when complete
//        reassignTo(unit);
//    }
//    else if(unit.memory.role == 'from' || unit.memory.role == 'From')
//    {
//        //Have flags 'To' and 'From' created, assigns 'idle' role when complete
//        reassignFrom(unit);
//    }
//    //reassignJob(Game.creeps.Worker12);
//}