#version 300 es
precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
out vec4 fragColor; 
#define GRID_SIZE 35.0  
#define PARTICLE_SPEED 1.8 
#define PARTICLE_WAVE_SCALE 8.0 
#define PARTICLE_WAVE_HEIGHT 0.1 
vec2 random2(vec2 st) {
    st = vec2(dot(st, vec2(127.1, 311.7)), dot(st, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(st) * 43758.5453123);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;

    uv.y *= u_resolution.y / u_resolution.x;

    vec2 grid_uv = uv * GRID_SIZE;

    vec2 grid_id = floor(grid_uv);

    vec2 cell_uv = fract(grid_uv);

    float final_color = 0.0;

    for(float y = -1.0; y <= 1.0; y+=1.5) {
        for(float x = -1.0; x <= 1.0; x+=1.5) {

            vec2 neighbor_id = grid_id + vec2(x, y);

            vec2 particle_base_pos = random2(neighbor_id) * 0.5 + 0.5;

            particle_base_pos.y += sin(u_time * PARTICLE_SPEED + (neighbor_id.x * PARTICLE_WAVE_SCALE)) * PARTICLE_WAVE_HEIGHT;

            vec2 offset = vec2(x, y) + particle_base_pos - cell_uv;
            float dist = length(offset);

            float particle_size = 0.04;

            float particle_intensity = smoothstep(particle_size, 0.0, dist);

            final_color = max(final_color, particle_intensity);
        }
    }
    
    fragColor = vec4(vec3(final_color), 1.0);
}