from rendering.meshes import Mesh
from coremaths.vector import Mat3

# load an .obj file into a mesh object:
meshPath = ""  # update to the path of the .obj you want to load
mesh = Mesh.loadFromOBJ(meshPath)

# get the mean of all the mesh's vertices (as a Vec3 object):
meanVert = mesh.meanVert
print(meanVert)

# shift the mesh to centre it on (0, 0, 0)
# (using a transform with no rotation (rotation matrix equal to identity matrix) and no scaling (scaling equal to 1):
shiftedMesh = mesh.transformed(Mat3.identity(), -meanVert, 1)

# the shifted mesh is centred on (0, 0, 0):
print(shiftedMesh.meanVert)

savePath = None  # update to your desired save path
shiftedMesh.saveOBJ(savePath)
