// Test that distributed lock forcing does not result in inconsistencies, using a 
// fast timeout.

// Note that this test will always have random factors, since we can't control the
// thread scheduling.

test = new SyncCCTest( "sync6", { logpath : "/dev/null" } )

// Startup another process to handle our commands to the cluster, mostly so it's 
// easier to read.
var commandConn = startMongodTest( 30000 + 4, "syncCommander", false, { logpath : "/dev/null" } )//{verbose : ""} )
// { logpath : "/data/db/syncCommander/mongod.log" } );

// Have lots of threads, so use larger i
// Can't test too many, we get socket exceptions... possibly due to the 
// javascript console.
for ( var i = 8; i < 12; i++ ) {

	// Our force time is 1 second
	var takeoverMS = 1000;

	// Generate valid sleep and skew for this timeout
	var threadSleepWithLock = takeoverMS / 2;
	var configServerTimeSkew = [ 0, 0, 0 ]
	for ( var h = 0; h < 3; h++ ) {
		// Skew by 1/30th the takeover time either way, at max
		configServerTimeSkew[h] = ( i + h ) % Math.floor( takeoverMS / 60 )
		// Make skew pos or neg
		configServerTimeSkew[h] *= ( ( i + h ) % 2 ) ? -1 : 1;
	}
	
	// Build command
	command = { _testDistLockWithSkew : 1 }
	
	// Basic test parameters
	command["lockName"] = "TimeSkewFailNewTest_lock_" + i;
	command["host"] = test.url
	command["seed"] = i
	command["numThreads"] = ( i % 50 ) + 1
	
	// Critical values so we're sure of correct operation
	command["takeoverMS"] = takeoverMS
	command["wait"] = 6 * takeoverMS // so we must force the lock
	command["skewHosts"] = configServerTimeSkew
	command["threadWait"] = threadSleepWithLock

	// Less critical test params
	
	// 1/3 of threads will not release the lock
	command["hangThreads"] = 3
	// Amount of time to wait before trying lock again
	command["threadSleep"] = 1;// ( ( i + 1 ) * 100 ) % (takeoverMS / 4)
	// Amount of total clock skew possible between locking threads (processes)
	// This can be large now.
	command["skewRange"] = ( command["takeoverMS"] * 3 ) * 60 * 1000

	// Double-check our sleep, host skew, and takeoverMS values again

	// At maximum, our threads must sleep only half the lock timeout time.
	assert( command["threadWait"] <= command["takeoverMS"] / 2 )
	for ( var h = 0; h < command["skewHosts"].length; h++ ) {
		// At maximum, our config server time skew needs to be less than 1/30th
		// the total time skew (1/60th either way).
		assert( Math.abs( command["skewHosts"][h] ) <= ( command["takeoverMS"] / 60 ) )
	}

	result = commandConn.getDB( "admin" ).runCommand( command )
	printjson( result )
	printjson( command )
	assert( result.ok, "Skewed threads did not increment correctly." );

}

stopMongoProgram( 30004 )
test.stop();
