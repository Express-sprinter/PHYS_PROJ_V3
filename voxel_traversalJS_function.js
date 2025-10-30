


function sign(x){
	if(x>0){
		return 1;
	}else if(x<0){
		return -1;
	}else{
		return 0;
	}
}

function convertToCubicGrid(x){
	return x;
}

function traversal(startP, endP){
	
	//we are returning the full list of places that we went - in the cube index
	// afterwards, we can simply go through each cube index  to see if we 
	//colidde with anything in each iof the given cubes - rather tahn the full list of meshes
	
	// gtting inital values
	var sx = startP[0];
	var sy = startP[1];
	var sz = startP[2];
	
	var ex = endP[0];
	var ey = endP[1];
	var ez = endP[2];
	
	// inital or integer values of the inital/start point 
	//REPLACE THIS PART WITH THE CUBIC GRID CONVERSION COORD FUNTION METHOD
	var ix = Math.floor(sx);
	var iy = Math.floor(sy);
	var iz = Math.floor(sz);
	
	//the same again, but for the trget values
	
	var tX = Math.floor(ex);
	var tY = Math.floor(ey);
	var tZ = Math.floor(ez);
	
	// recording where we go
	var listOfPLacesWeWent = [[ix,iy,iz]];

	// the difference in the point
	var dx = ex - sx;
	var dy = ey - sy;
	var dz = ez - sz;

	//are we actually already there?
	if(dx==0 && dy==0 && dz==0){
		return listOfPLacesWeWent;
	}
	// the increment each time - but this is for integers... may need to change
	var stepX = sign(dx);
	var stepY = sign(dy);
	var stepZ = sign(dz);
	
	function tMax_delta_comp(p0_coord, d, i_voxel, step){
		if(d==0){
			return null;// the code returns two sets of infinites... lets see waht it does with it
		}
        var	nextBoundary = 0;
		if(step>0){
			nextBoundary = i_voxel+1.0; // crossing at teh next voxel
		}else{
			nextBoundary = i_voxel*1.0; // crossing the voxel here
		}
		var tmax = (nextBoundary - p0_coord) / d;
		var tdelta =  1.0/Math.abs(d);
		return [tmax, tdelta];
	}
	
	var OUTX =  tMax_delta_comp(sx,dx,ix,stepX);
	var OUTX =  tMax_delta_comp(sx,dx,ix,stepY);
	var OUTX =  tMax_delta_comp(sx,dx,ix,stepZ);
	
}