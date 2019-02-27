#version 430 core

#define _POINT_LIGHTS_COUNT 64
#define EPSILON 0.0001
#define BLACK vec4(0.0f,0.0f,0.0f,1.0f);
#define MAX_STEPS 255
#define MAX_DISTANCE 100.0f

struct PointLight {
	vec3 color;
	vec3 position;
	vec3 attenuation;
};

struct Ray {
	vec3 origin;
	vec3 direction;
};

struct Hit {
	float distance;
	vec3 position;
	vec3 normal;
};

out vec4 FragColor;

in vec2 TexCoords;
in vec3 viewDirection;
in Ray ray;

uniform PointLight pointLights[_POINT_LIGHTS_COUNT];

uniform int nrPointLight;
uniform vec3 cameraPosition;
uniform float time;
uniform float mouse_x;
uniform float mouse_y;

float sphereSDF(vec3 pos){
	return length(pos)-1;
}

/**
 * Signed distance function for a cube centered at the origin
 * with width = height = length = 2.0
 */
float cubeSDF(vec3 p) {
    // If d.x < 0, then -1 < p.x < 1, and same logic applies to p.y, p.z
    // So if all components of d are negative, then p is inside the unit cube
    vec3 d = abs(p) - vec3(1.0, 1.0, 1.0);
    
    // Assuming p is inside the cube, how far is it from the surface?
    // Result will be negative or zero.
    float insideDistance = min(max(d.x, max(d.y, d.z)), 0.0);
    
    // Assuming p is outside the cube, how far is it from the surface?
    // Result will be positive or zero.
    float outsideDistance = length(max(d, 0.0));
    
    return insideDistance + outsideDistance;
}

float sceneSDF(vec3 pos){
	return sphereSDF(pos);
}

vec3 calculateNormal(vec3 p){
	return normalize(vec3(
        sceneSDF(vec3(p.x + EPSILON, p.y, p.z)) - sceneSDF(vec3(p.x - EPSILON, p.y, p.z)),
        sceneSDF(vec3(p.x, p.y + EPSILON, p.z)) - sceneSDF(vec3(p.x, p.y - EPSILON, p.z)),
        sceneSDF(vec3(p.x, p.y, p.z  + EPSILON)) - sceneSDF(vec3(p.x, p.y, p.z - EPSILON))
    ));
}

//Calculates distance of first hit
Hit rayMarching(vec3 start, vec3 direction){
	Hit result;
	float depth = EPSILON;
	for(int i = 0; i<MAX_STEPS; ++i){
		float dist = sceneSDF(start+depth*direction);
		if(dist < EPSILON){
			result.distance = depth;
			result.position = start+depth*direction;
			result.normal = calculateNormal(result.position);
			return result;
		}
		depth += dist;
		if(depth > MAX_DISTANCE){
			result.distance = MAX_DISTANCE + EPSILON;
			return result;
		}
	}
	result.distance = MAX_DISTANCE + EPSILON;
	return result;
}

void main() {
	vec3 rayDirection = normalize(ray.direction);
	FragColor = vec4(rayDirection,1.0f);
	Hit closestHit = rayMarching(ray.origin, rayDirection);
	if(closestHit.distance > MAX_DISTANCE){
		FragColor = BLACK;
		return;
	}else{
		FragColor = vec4(closestHit.normal,1.0f);
		return;
	}
}
