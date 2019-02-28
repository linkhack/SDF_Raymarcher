#version 430 core

#define EPSILON 0.00001
#define BLACK vec4(0.0f,0.0f,0.0f,1.0f);
#define MAX_STEPS 255
#define MAX_DISTANCE 100.0f

#define _DIRECTIONAL_LIGHTS_COUNT 1
#define _POINT_LIGHTS_COUNT 1
#define _SPOT_LIGHT_COUNT 1


// Light properties structs
struct PointLight {
	vec3 color;
	vec3 position;
	vec3 attenuation;
};

struct DirectionalLight {
	vec3 color;
	vec3 direction;
};

struct SpotLight {
	vec3 color;
	vec3 position;
	vec3 direction;
	float innerOpeningAngle;
	float outerOpeningAngle;
	vec3 attenuation;
};

//Ray and Hit structs
struct Ray {
	vec3 origin;
	vec3 direction;
};

struct Hit {
	float distance;
	vec3 viewDirection;
	vec3 position;
	vec3 normal;
};

//Material struct
struct Material {
	vec3 color;
	vec3 ambient;
	vec3 diffuse;
	vec3 specular;
	float specularCoefficient;
};

out vec4 FragColor;

in vec2 TexCoords;
in vec3 viewDirection;
in Ray ray;

//Lights
uniform PointLight pointLights[_POINT_LIGHTS_COUNT];
uniform DirectionalLight directionalLights[_DIRECTIONAL_LIGHTS_COUNT];
uniform SpotLight spotLights[_SPOT_LIGHT_COUNT];
uniform int nrPointLight;
uniform int nrDirLight;
uniform int nrSpotLight;

uniform vec3 cameraPosition;
uniform float time;
uniform float mouse_x;
uniform float mouse_y;

//Matrial constant
const Material mat = {vec3(0.83137f,0.68627f,0.21568),vec3(0.1f),vec3(0.8f),vec3(0.1f),15.0f};


float sphereSDF(vec3 pos){
	return length(pos)-0.11;
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
	vec3 c = 0.4*vec3(4,4,3);
	vec3 q = mod(pos,c)-0.5f*c;
    return sphereSDF( q );
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
			result.viewDirection = direction;
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

// Calculations for shading / light
float diffuse(vec3 normal, vec3 lightDir){
	return max(0,dot(normal,lightDir));
}

float specular(vec3 normal, vec3 lightDir, vec3 viewingDir){
	vec3 r = reflect(-lightDir, normal);
	
	return max(0,pow(dot(r,viewingDir),mat.specularCoefficient));
}

vec3 addPointLight(vec3 normal, vec3 viewingDir, vec3 lightDir,  PointLight light){
	vec3 color = vec3(0.0f);
	//TODO: shadow ray
	color += mat.diffuse * mat.color * light.color * diffuse(normal,lightDir);
	color += mat.specular * mat.color * light.color *specular(normal,lightDir,viewingDir);
	//TODO reflection
	return color;
}

vec3 addDirectionalLight(vec3 normal, vec3 viewingDir,  DirectionalLight light){
	vec3 color = vec3(0.0f);
	
	color += mat.diffuse * mat.color * light.color * diffuse(normal,-light.direction);
	color += mat.specular * mat.color * light.color * specular(normal,-light.direction,viewingDir);
	
	return color;
}

vec3 addSpotLight(vec3 normal, vec3 viewingDir, vec3 lightDir, SpotLight light){
	vec3 color = vec3(0.0f);
	float outerCos = cos(light.outerOpeningAngle);
	float innerCos = cos(light.innerOpeningAngle);
	float directionCos = dot(-lightDir,light.direction);
	float interpolationT = 1.0f-smoothstep(innerCos,outerCos,directionCos);
	color += interpolationT * mat.diffuse * mat.color * light.color * diffuse(normal,lightDir);
	color += interpolationT * mat.specular * mat.color * light.color * light.color * specular(normal,lightDir,viewingDir);

	return color;
}

//Calculates Shading of Hit w.r.t all lights
vec4 calculateShading(Hit hit){
	vec4 color = vec4(mat.ambient*mat.color,1);
	
	vec3 worldPosition = hit.position;
	
	vec3 v = -hit.viewDirection;
	
	vec3 normalWorld = hit.normal;
	
	for(int i = 0; i<_POINT_LIGHTS_COUNT; ++i){
		PointLight light = pointLights[i];
		vec3 l = light.position - worldPosition.xyz;
		float d = length(l);
		l = l/d;
		float attenuation = 1/(light.attenuation.x*d*d+light.attenuation.y*d+light.attenuation.z);
		if(attenuation < EPSILON) continue;
		color+=vec4(addPointLight(normalWorld, v, l, light)*attenuation,0.0f);
	}
	
	for(int i = 0; i< _DIRECTIONAL_LIGHTS_COUNT; ++i){
		DirectionalLight light = directionalLights[i];
		color += vec4(addDirectionalLight(normalWorld,v,light),0.0f);
	}
	/*
	for(int i = 0; i<nrSpotLight; ++i){
		SpotLight light = spotLights[i];
		vec3 l = light.position - worldPosition.xyz;
		float d = length(l);
		l = l/d;
		float attenuation = 1/(light.attenuation.x*d*d+light.attenuation.y*d+light.attenuation.z);
		color+=vec4(addSpotLight(normalWorld, v, l, light)*attenuation,0.0f);
	}
	*/
	return color;
}

void main() {
	vec3 rayDirection = normalize(ray.direction);
	Hit closestHit = rayMarching(ray.origin, rayDirection);
	if(closestHit.distance > MAX_DISTANCE){
		FragColor = BLACK;
		return;
	}else{
		FragColor = calculateShading(closestHit);
		return;
	}
}