'use strict';
// =====================================================================
// 렌더러 (WebGL2) - 셰이더 스타일: 그림자 맵, 부드러운 조명, 물 반사,
// 하늘/구름/별, 안개, 블룸, 빛내림(갓레이), ACES 톤매핑
// =====================================================================
const GLSL_SKY = `
uniform vec3 u_skyTop; uniform vec3 u_skyHor; uniform vec3 u_sunGlow; uniform vec3 u_sunPos;
vec3 skyColor(vec3 d){
  float y = d.y;
  vec3 c = mix(u_skyHor, u_skyTop, pow(clamp(y, 0.0, 1.0), 0.45));
  if (y < 0.0) c = mix(u_skyHor, u_skyHor * 0.55, clamp(-y * 2.5, 0.0, 1.0));
  float sd = max(dot(d, u_sunPos), 0.0);
  c += u_sunGlow * (pow(sd, 6.0) * 0.42 + pow(sd, 48.0) * 0.6) * (1.0 - clamp(y, 0.0, 1.0) * 0.5);
  return c;
}`;

const TERRAIN_VS = `#version 300 es
precision highp float; precision highp int;
layout(location=0) in vec3 a_pos;
layout(location=1) in vec2 a_uv;
layout(location=2) in uvec2 a_info;
layout(location=3) in vec4 a_light;
layout(location=4) in vec4 a_tint;
uniform mat4 u_viewProj; uniform mat4 u_model; uniform vec3 u_chunkPos; uniform vec3 u_camPos;
uniform float u_time; uniform mat4 u_shadowMat; uniform float u_wind;
out vec3 v_uvl; out vec3 v_rel; out vec3 v_world; out vec4 v_light; out vec3 v_tint; flat out uint v_flags; out vec4 v_sp; out vec3 v_nrm;
const vec3 NRM[6] = vec3[6](vec3(0.,-1.,0.), vec3(0.,1.,0.), vec3(0.,0.,-1.), vec3(0.,0.,1.), vec3(-1.,0.,0.), vec3(1.,0.,0.));
void main(){
  uint fl = a_info.y;
  vec3 rel = (u_model * vec4(a_pos, 1.0)).xyz + u_chunkPos;
  vec3 wp = rel + u_camPos;
  uint wave = (fl >> 3u) & 3u;
  if (wave == 1u) {
    float t = u_time * 1.7 + wp.x * 0.6 + wp.z * 0.45 + wp.y * 0.3;
    rel += vec3(sin(t), sin(t * 1.3) * 0.5, cos(t * 0.9)) * 0.03 * u_wind;
  } else if (wave == 2u && a_light.w > 0.5) {
    float t = u_time * 2.0 + wp.x * 0.7 + wp.z * 0.5;
    rel.xz += vec2(sin(t), cos(t * 0.8)) * 0.07 * u_wind;
  } else if (wave == 3u && a_light.w > 0.5) {
    rel.y += (sin(u_time * 1.4 + wp.x * 0.8 + wp.z * 0.3) * 0.5 + sin(u_time * 1.9 + wp.z * 0.9 - wp.x * 0.2) * 0.5) * 0.045 - 0.045;
  }
  v_rel = rel; v_world = rel + u_camPos;
  v_uvl = vec3(a_uv, float(a_info.x));
  v_light = a_light; v_tint = a_tint.rgb * 1.5; v_flags = fl;
  vec3 n = normalize(mat3(u_model) * NRM[min(fl & 7u, 5u)]);
  v_nrm = n;
  v_sp = u_shadowMat * vec4(rel + n * 0.06, 1.0);
  gl_Position = u_viewProj * vec4(rel, 1.0);
}`;

const TERRAIN_FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2DArray; precision highp sampler2DShadow;
in vec3 v_uvl; in vec3 v_rel; in vec3 v_world; in vec4 v_light; in vec3 v_tint; flat in uint v_flags; in vec4 v_sp; in vec3 v_nrm;
uniform sampler2DArray u_atlas; uniform sampler2DShadow u_shadow;
uniform float u_shadowOn; uniform vec3 u_lightDir; uniform vec3 u_sunCol; uniform vec3 u_ambCol; uniform vec3 u_blockCol;
uniform float u_fogNear; uniform float u_fogFar; uniform float u_time; uniform vec3 u_entLight; uniform float u_flash;
uniform float u_underwater; uniform vec3 u_waterFog; uniform float u_outScale; uniform float u_bright; uniform float u_alphaMul; uniform vec3 u_dimAmb;
${GLSL_SKY}
out vec4 o_col;
float shadowLookup(){
  vec3 p = v_sp.xyz / v_sp.w * 0.5 + 0.5;
  if (p.x <= 0.001 || p.x >= 0.999 || p.y <= 0.001 || p.y >= 0.999 || p.z >= 1.0) return 1.0;
  vec2 ts = 1.0 / vec2(textureSize(u_shadow, 0));
  float s = 0.0;
  s += texture(u_shadow, vec3(p.xy + vec2(-0.6, -0.6) * ts, p.z));
  s += texture(u_shadow, vec3(p.xy + vec2( 0.6, -0.6) * ts, p.z));
  s += texture(u_shadow, vec3(p.xy + vec2(-0.6,  0.6) * ts, p.z));
  s += texture(u_shadow, vec3(p.xy + vec2( 0.6,  0.6) * ts, p.z));
  s *= 0.25;
  vec2 e = min(p.xy, 1.0 - p.xy);
  float edge = smoothstep(0.0, 0.08, min(e.x, e.y));
  return mix(1.0, s, edge);
}
void main(){
  vec4 tex = texture(u_atlas, v_uvl);
#ifdef CUTOUT
  if (tex.a < 0.4) discard;
#endif
  uint fl = v_flags;
  vec3 albedo = pow(tex.rgb, vec3(2.2)) * v_tint;
  float sky = v_light.x, blk = v_light.y, ao = v_light.z;
  if (u_entLight.z > 0.5) { sky = u_entLight.x; blk = u_entLight.y; }
  bool emis = (fl & 32u) != 0u;
  bool plant = (fl & 128u) != 0u;
  vec3 N = v_nrm;
  float aoF = mix(0.58, 1.0, ao);
  float skyF = sky * sky;
  float ndl = plant ? 0.7 : max(dot(N, u_lightDir), 0.0);
  float sh = 1.0;
  if (u_shadowOn > 0.5 && ndl > 0.0) sh = shadowLookup();
  sh *= smoothstep(0.5, 0.93, sky);
  float faceShade = N.y > 0.5 ? 1.0 : (N.y < -0.5 ? 0.72 : (abs(N.x) > 0.5 ? 0.86 : 0.93));
  vec3 direct = u_sunCol * ndl * mix(0.18, 1.0, sh);
  vec3 amb = u_ambCol * skyF * (0.82 + 0.18 * N.y) * faceShade;
  float flick = 1.0 + sin(u_time * 11.0 + v_world.x * 3.1 + v_world.z * 1.7) * 0.025;
  vec3 blockL = u_blockCol * pow(blk, 2.4) * 1.7 * flick;
  vec3 lighting = (amb + direct + u_dimAmb * faceShade) * aoF + blockL * aoF * (0.6 + 0.4 * faceShade) + vec3(0.03, 0.03, 0.05) + vec3(u_bright * 0.25);
  vec3 col = albedo * lighting;
  if (emis) col = albedo * 2.4 + col * 0.25;
  float alpha = 1.0;
#ifdef TRANS
  bool water = ((fl >> 3u) & 3u) == 3u;
  if (water) {
    vec3 V = normalize(-v_rel);
    vec2 p = v_world.xz; float t = u_time;
    vec3 n = N;
    if (N.y > 0.5) {
      n = vec3(sin(p.x * 1.3 + t * 1.5) * 0.06 + sin(p.x * 3.1 - p.y * 2.3 + t * 2.3) * 0.03 + sin((p.x + p.y) * 5.7 + t * 3.1) * 0.015,
               1.0,
               cos(p.y * 1.1 + t * 1.3) * 0.06 + cos(p.y * 2.9 + p.x * 1.7 + t * 2.1) * 0.03 + cos((p.x - p.y) * 6.1 + t * 2.7) * 0.015);
      n = normalize(n);
    }
    float cosv = abs(dot(n, V));
    float fres = 0.03 + 0.97 * pow(1.0 - cosv, 5.0);
    vec3 R = reflect(-V, n); R.y = abs(R.y);
    vec3 refl = skyColor(R) * (0.25 + 0.75 * skyF);
    vec3 base = vec3(0.10, 0.36, 0.48) * (u_ambCol * skyF * 1.4 + u_sunCol * 0.3 * sh + blockL) + albedo * lighting * 0.3;
    float spec = pow(max(dot(R, u_lightDir), 0.0), 220.0) * sh * 5.0 * skyF;
    if (u_underwater > 0.5) { fres = 0.1; }
    col = mix(base, refl, fres) + u_sunCol * spec;
    alpha = mix(0.55, 0.92, fres);
  } else {
    alpha = tex.a;
  }
  alpha *= u_alphaMul;
#endif
  if (u_flash > 0.0) col = mix(col, vec3(1.8), u_flash);
  float dist = length(v_rel);
  vec3 fc;
  float fog;
  if (u_underwater > 0.5) { fog = 1.0 - exp(-dist * 0.09); fc = u_waterFog; }
  else { fog = smoothstep(u_fogNear, u_fogFar, dist); fc = skyColor(normalize(v_rel)); }
  col = mix(col, fc, fog);
  o_col = vec4(col * u_outScale, alpha);
}`;

const SHADOW_VS = `#version 300 es
precision highp float; precision highp int;
layout(location=0) in vec3 a_pos; layout(location=1) in vec2 a_uv; layout(location=2) in uvec2 a_info; layout(location=3) in vec4 a_light;
uniform mat4 u_viewProj; uniform vec3 u_chunkPos; uniform vec3 u_camPos; uniform float u_time; uniform float u_wind;
out vec3 v_uvl;
void main(){
  uint fl = a_info.y;
  vec3 rel = a_pos + u_chunkPos; vec3 wp = rel + u_camPos;
  uint wave = (fl >> 3u) & 3u;
  if (wave == 1u) { float t = u_time * 1.7 + wp.x * 0.6 + wp.z * 0.45 + wp.y * 0.3; rel += vec3(sin(t), sin(t * 1.3) * 0.5, cos(t * 0.9)) * 0.03 * u_wind; }
  else if (wave == 2u && a_light.w > 0.5) { float t = u_time * 2.0 + wp.x * 0.7 + wp.z * 0.5; rel.xz += vec2(sin(t), cos(t * 0.8)) * 0.07 * u_wind; }
  v_uvl = vec3(a_uv, float(a_info.x));
  gl_Position = u_viewProj * vec4(rel, 1.0);
}`;
const SHADOW_FS = `#version 300 es
precision highp float; precision highp sampler2DArray;
in vec3 v_uvl; uniform sampler2DArray u_atlas; out vec4 o_col;
void main(){
#ifdef CUTOUT
  if (texture(u_atlas, v_uvl).a < 0.4) discard;
#endif
  o_col = vec4(1.0);
}`;

const FS_TRI_VS = `#version 300 es
precision highp float;
out vec2 v_uv; out vec2 v_ndc;
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  v_uv = p; v_ndc = p * 2.0 - 1.0;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const SKY_FS = `#version 300 es
precision highp float;
in vec2 v_ndc; uniform mat4 u_invVP; uniform float u_dayF; uniform float u_time; uniform float u_clouds;
uniform vec2 u_camXZ; uniform float u_camY; uniform float u_outScale; uniform vec3 u_sunDisk; uniform float u_rain;
${GLSL_SKY}
out vec4 o_col;
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
void main(){
  vec4 p = u_invVP * vec4(v_ndc, 1.0, 1.0);
  vec3 d = normalize(p.xyz / p.w);
  vec3 c = skyColor(d);
  float night = 1.0 - u_dayF;
  if (night > 0.02 && d.y > 0.0) {
    vec3 sp = floor(d * 260.0); float h = hash(sp);
    if (h > 0.9975) c += vec3(0.9, 0.95, 1.0) * ((h - 0.9975) / 0.0025) * night * smoothstep(0.0, 0.25, d.y) * (0.6 + 0.4 * sin(u_time * 3.0 + h * 100.0)) * (1.0 - u_rain);
  }
  float sd = dot(d, u_sunPos);
  c += u_sunDisk * smoothstep(0.99955, 0.9998, sd) * 18.0 * (1.0 - u_rain);
  float md = dot(d, -u_sunPos);
  float moon = smoothstep(0.99935, 0.9996, md);
  c += vec3(0.85, 0.9, 1.0) * moon * 1.6 * night;
  c += vec3(0.3, 0.35, 0.5) * pow(max(md, 0.0), 60.0) * 0.4 * night;
  if (d.y > 0.005 && u_clouds > 0.5) {
    float t = (192.0 - u_camY) / d.y;
    if (t > 0.0) {
      vec2 cp = (u_camXZ + d.xz * t) * 0.0045 + vec2(u_time * 0.006, u_time * 0.002);
      float n = fbm(cp);
      float cov = smoothstep(0.5 - u_rain * 0.25, 0.78 - u_rain * 0.2, n);
      float lit = clamp(0.6 + (fbm(cp + u_sunPos.xz * 0.05) - n) * 3.0, 0.3, 1.2);
      vec3 cc = mix(u_skyHor, vec3(1.0), 0.55) * (0.25 + 0.75 * u_dayF) * lit + u_sunGlow * 0.25;
      cc = mix(cc, vec3(0.45) * (0.3 + 0.7 * u_dayF), u_rain * 0.7);
      float fade = smoothstep(0.0, 0.2, d.y) * (1.0 - smoothstep(4000.0, 9000.0, t));
      c = mix(c, cc, cov * fade * 0.92);
    }
  }
  o_col = vec4(c * u_outScale, 1.0);
}`;

const POST_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_scene; uniform sampler2D u_bloom; uniform sampler2D u_depth;
uniform vec2 u_sunUV; uniform float u_rays; uniform vec3 u_rayCol; uniform float u_bloomOn; uniform float u_underwater;
uniform float u_time; uniform float u_exposure; uniform float u_hdrScale; uniform float u_hurt; uniform float u_sat;
out vec4 o_col;
vec3 aces(vec3 x){ const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14; return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0); }
void main(){
  vec2 uv = v_uv;
  if (u_underwater > 0.5) uv += vec2(sin(uv.y * 22.0 + u_time * 2.0), cos(uv.x * 18.0 + u_time * 1.7)) * 0.0025;
  vec3 c = texture(u_scene, uv).rgb * u_hdrScale;
  if (u_bloomOn > 0.5) c += texture(u_bloom, uv).rgb * u_hdrScale * 0.32;
  if (u_rays > 0.005) {
    vec2 dl = (u_sunUV - uv) / 36.0; vec2 p = uv; float acc = 0.0; float w = 1.0;
    for (int i = 0; i < 36; i++) {
      p += dl;
      if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) break;
      acc += (texture(u_depth, p).r >= 0.99999 ? 1.0 : 0.0) * w; w *= 0.96;
    }
    float fall = 1.0 - smoothstep(0.0, 0.9, length((uv - u_sunUV) * vec2(1.6, 1.0)));
    c += u_rayCol * (acc / 36.0) * u_rays * fall;
  }
  c *= u_exposure;
  c = aces(c);
  c = pow(c, vec3(1.0 / 2.2));
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, u_sat);
  c = mix(c, vec3(1.0, 0.98, 1.0), 0.05);
  float vig = smoothstep(1.25, 0.3, length(v_uv - 0.5) * 1.45);
  c *= mix(0.86, 1.0, vig);
  if (u_underwater > 0.5) c *= vec3(0.55, 0.8, 1.05);
  if (u_hurt > 0.0) c = mix(c, vec3(0.8, 0.05, 0.05), u_hurt * 0.35 * (1.0 - vig * 0.7));
  o_col = vec4(c, 1.0);
}`;
const BRIGHT_FS = `#version 300 es
precision highp float;
in vec2 v_uv; uniform sampler2D u_tex; uniform float u_threshold; out vec4 o_col;
void main(){
  vec2 ts = 1.0 / vec2(textureSize(u_tex, 0));
  vec3 c = (texture(u_tex, v_uv + ts * vec2(-0.5, -0.5)).rgb + texture(u_tex, v_uv + ts * vec2(0.5, -0.5)).rgb + texture(u_tex, v_uv + ts * vec2(-0.5, 0.5)).rgb + texture(u_tex, v_uv + ts * vec2(0.5, 0.5)).rgb) * 0.25;
  float l = max(c.r, max(c.g, c.b));
  o_col = vec4(c * smoothstep(u_threshold, u_threshold * 1.8, l), 1.0);
}`;
const BLUR_FS = `#version 300 es
precision highp float;
in vec2 v_uv; uniform sampler2D u_tex; uniform vec2 u_dir; out vec4 o_col;
void main(){
  vec2 ts = u_dir / vec2(textureSize(u_tex, 0));
  vec3 c = texture(u_tex, v_uv).rgb * 0.227;
  c += (texture(u_tex, v_uv + ts * 1.384).rgb + texture(u_tex, v_uv - ts * 1.384).rgb) * 0.316;
  c += (texture(u_tex, v_uv + ts * 3.230).rgb + texture(u_tex, v_uv - ts * 3.230).rgb) * 0.070;
  o_col = vec4(c, 1.0);
}`;
const ENT_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_pos; layout(location=1) in vec3 a_nrm; layout(location=2) in vec3 a_col; layout(location=3) in vec2 a_light; layout(location=4) in vec3 a_loc;
uniform mat4 u_viewProj;
out vec3 v_nrm; out vec3 v_col; out vec2 v_light; out vec3 v_rel; out vec3 v_loc;
void main(){ v_nrm = a_nrm; v_col = a_col; v_light = a_light; v_rel = a_pos; v_loc = a_loc; gl_Position = u_viewProj * vec4(a_pos, 1.0); }`;
const ENT_FS = `#version 300 es
precision highp float;
in vec3 v_nrm; in vec3 v_col; in vec2 v_light; in vec3 v_rel; in vec3 v_loc;
uniform vec3 u_lightDir; uniform vec3 u_sunCol; uniform vec3 u_ambCol; uniform vec3 u_blockCol; uniform float u_fogNear; uniform float u_fogFar;
uniform float u_underwater; uniform vec3 u_waterFog; uniform float u_outScale; uniform float u_bright; uniform vec3 u_dimAmb;
${GLSL_SKY}
out vec4 o_col;
float hh(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main(){
  vec3 N = normalize(v_nrm);
  vec3 alb = pow(v_col, vec3(2.2));
  float grain = hh(floor(v_loc * 16.0 + 0.001));
  alb *= 0.9 + grain * 0.2;
  float sky = v_light.x, blk = v_light.y;
  float faceShade = N.y > 0.5 ? 1.0 : (N.y < -0.5 ? 0.6 : (abs(N.x) > 0.5 ? 0.78 : 0.88));
  vec3 lighting = u_ambCol * sky * sky * faceShade + u_sunCol * max(dot(N, u_lightDir), 0.0) * smoothstep(0.5, 0.93, sky) + u_blockCol * pow(blk, 2.4) * 1.7 + vec3(0.05 + u_bright * 0.25) + u_dimAmb * faceShade;
  vec3 col = alb * lighting;
  float dist = length(v_rel);
  if (u_underwater > 0.5) col = mix(col, u_waterFog, 1.0 - exp(-dist * 0.09));
  else col = mix(col, skyColor(normalize(v_rel)), smoothstep(u_fogNear, u_fogFar, dist));
  o_col = vec4(col * u_outScale, 1.0);
}`;
// 아바타 스킨 (64x64 텍스처 배열)
const SKIN_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_pos; layout(location=1) in vec3 a_nrm; layout(location=2) in vec2 a_uv; layout(location=3) in float a_layer; layout(location=4) in vec2 a_light; layout(location=5) in vec3 a_tint;
uniform mat4 u_viewProj;
out vec3 v_nrm; out vec2 v_uv; flat out float v_layer; out vec2 v_light; out vec3 v_tint; out vec3 v_rel;
void main(){ v_nrm = a_nrm; v_uv = a_uv; v_layer = a_layer; v_light = a_light; v_tint = a_tint; v_rel = a_pos; gl_Position = u_viewProj * vec4(a_pos, 1.0); }`;
const SKIN_FS = `#version 300 es
precision highp float; precision highp sampler2DArray;
in vec3 v_nrm; in vec2 v_uv; flat in float v_layer; in vec2 v_light; in vec3 v_tint; in vec3 v_rel;
uniform sampler2DArray u_skins;
uniform vec3 u_lightDir; uniform vec3 u_sunCol; uniform vec3 u_ambCol; uniform vec3 u_blockCol; uniform float u_fogNear; uniform float u_fogFar;
uniform float u_underwater; uniform vec3 u_waterFog; uniform float u_outScale; uniform float u_bright; uniform vec3 u_dimAmb;
${GLSL_SKY}
out vec4 o_col;
void main(){
  float L = v_layer; bool base = L > 999.5; if (base) L -= 1000.0;
  vec4 t = texture(u_skins, vec3(v_uv, L));
  if (!base && t.a < 0.5) discard;
  vec3 N = normalize(v_nrm);
  vec3 alb = pow(t.rgb, vec3(2.2)) * v_tint;
  float sky = v_light.x, blk = v_light.y;
  float faceShade = N.y > 0.5 ? 1.0 : (N.y < -0.5 ? 0.62 : (abs(N.x) > 0.5 ? 0.8 : 0.9));
  vec3 lighting = u_ambCol * sky * sky * faceShade + u_sunCol * max(dot(N, u_lightDir), 0.0) * smoothstep(0.5, 0.93, sky) + u_blockCol * pow(blk, 2.4) * 1.7 + vec3(0.08 + u_bright * 0.25) + u_dimAmb * faceShade;
  vec3 col = alb * lighting;
  float dist = length(v_rel);
  if (u_underwater > 0.5) col = mix(col, u_waterFog, 1.0 - exp(-dist * 0.09));
  else col = mix(col, skyColor(normalize(v_rel)), smoothstep(u_fogNear, u_fogFar, dist));
  o_col = vec4(col * u_outScale, 1.0);
}`;
const LINE_VS = `#version 300 es
precision highp float; layout(location=0) in vec3 a_pos; uniform mat4 u_viewProj; void main(){ gl_Position = u_viewProj * vec4(a_pos, 1.0); }`;
const LINE_FS = `#version 300 es
precision highp float; uniform vec4 u_color; out vec4 o_col; void main(){ o_col = u_color; }`;

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL2를 지원하지 않는 브라우저입니다.');
    this.gl = gl;
    this.hdr = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('EXT_color_buffer_half_float');
    this.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    this.quality = 2; this.renderScale = 1; this.shadowSize = 2048;
    this.progs = {};
    this.proj = M4.create(); this.view = M4.create(); this.viewProj = M4.create(); this.invVP = M4.create();
    this.shadowVP = M4.create(); this.shadowMat = M4.create();
    this.identity = M4.create();
    this.stats = { chunks: 0, tris: 0 };
    this.init();
  }
  compile(vs, fs, defines) {
    const gl = this.gl;
    const pre = (src) => defines ? src.replace('#version 300 es', '#version 300 es\n' + defines.map(d => '#define ' + d).join('\n')) : src;
    const mk = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, pre(src)); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); console.error(log, pre(src)); throw new Error('셰이더 오류: ' + log); }
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('프로그램 링크 오류: ' + gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  init() {
    const gl = this.gl;
    this.progs.opaque = this.compile(TERRAIN_VS, TERRAIN_FS, []);
    this.progs.cutout = this.compile(TERRAIN_VS, TERRAIN_FS, ['CUTOUT']);
    this.progs.trans = this.compile(TERRAIN_VS, TERRAIN_FS, ['TRANS']);
    this.progs.shadow = this.compile(SHADOW_VS, SHADOW_FS, []);
    this.progs.shadowCut = this.compile(SHADOW_VS, SHADOW_FS, ['CUTOUT']);
    this.progs.sky = this.compile(FS_TRI_VS, SKY_FS);
    this.progs.post = this.compile(FS_TRI_VS, POST_FS);
    this.progs.bright = this.compile(FS_TRI_VS, BRIGHT_FS);
    this.progs.blur = this.compile(FS_TRI_VS, BLUR_FS);
    this.progs.ent = this.compile(ENT_VS, ENT_FS);
    this.progs.skin = this.compile(SKIN_VS, SKIN_FS);
    this.progs.line = this.compile(LINE_VS, LINE_FS);
    this.emptyVAO = gl.createVertexArray();
    // 텍스처 배열
    const n = TEX.list.length;
    this.atlas = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.atlas);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, 16, 16, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (let i = 0; i < n; i++) gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, 16, 16, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(TEX.list[i].buffer));
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAX_LEVEL, 4);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // 공유 인덱스 버퍼 (사각형 → 삼각형 2개)
    this.ibo = gl.createBuffer(); this.iboQuads = 0;
    this.ensureIndices(65536);
    // 엔티티/선 동적 버퍼
    this.entVAO = gl.createVertexArray(); this.entVBO = gl.createBuffer();
    gl.bindVertexArray(this.entVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.entVBO);
    const es = 14 * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, es, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, es, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, es, 24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, es, 36);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 3, gl.FLOAT, false, es, 44);
    this.lineVAO = gl.createVertexArray(); this.lineVBO = gl.createBuffer();
    gl.bindVertexArray(this.lineVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVBO);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    // 동적 지형 형식 버퍼 (파티클, 균열, 등)
    this.dynVAO = this.makeTerrainVAO(null); this.dynBuf = new MeshBuf(1024);
    gl.bindVertexArray(null);
    this.ent = new EntityBatch();
    // 아바타 스킨
    this.skin = new SkinBatch();
    this.skinVAO = gl.createVertexArray(); this.skinVBO = gl.createBuffer();
    gl.bindVertexArray(this.skinVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.skinVBO);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, es, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, es, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, es, 24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, es, 32);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 2, gl.FLOAT, false, es, 36);
    gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 3, gl.FLOAT, false, es, 44);
    gl.bindVertexArray(null);
    this.skinLayers = 24; this.skinSlots = new Map(); this.skinFrame = 0;
    this.skinTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.skinTex);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, 64, 64, this.skinLayers, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 0, 64, 64, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(composeSkin(AV_DEFAULT).buffer));
    this.setupShadow(this.shadowSize);
    this.fbW = 0; this.fbH = 0;
  }
  ensureIndices(quads) {
    if (quads <= this.iboQuads) return;
    const gl = this.gl;
    let q = Math.max(quads, this.iboQuads * 2 || 65536);
    const idx = new Uint32Array(q * 6);
    for (let i = 0; i < q; i++) { const b = i * 4, o = i * 6; idx[o] = b; idx[o + 1] = b + 1; idx[o + 2] = b + 2; idx[o + 3] = b; idx[o + 4] = b + 2; idx[o + 5] = b + 3; }
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    this.iboQuads = q;
    // 모든 VAO가 같은 ibo 객체를 참조하므로 다시 바인딩할 필요 없음
  }
  makeTerrainVAO(data) {
    const gl = this.gl;
    const vao = gl.createVertexArray(); const vbo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    if (data) gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, VSTRIDE, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, VSTRIDE, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribIPointer(2, 2, gl.UNSIGNED_SHORT, VSTRIDE, 20);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, VSTRIDE, 24);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 4, gl.UNSIGNED_BYTE, true, VSTRIDE, 28);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bindVertexArray(null);
    return { vao, vbo };
  }
  uploadChunk(c, arrays) {
    this.deleteChunkMesh(c);
    this.meshGen = (this.meshGen || 0) + 1;
    const gl = this.gl;
    c.mesh = arrays.map(a => {
      if (!a) return null;
      const count = a.length / VSTRIDE;
      this.ensureIndices(count / 4 + 1);
      const m = this.makeTerrainVAO(a);
      m.count = count; m.bytes = a.length;
      return m;
    });
  }
  deleteChunkMesh(c) {
    if (!c.mesh) return;
    const gl = this.gl;
    for (const m of c.mesh) if (m) { gl.deleteBuffer(m.vbo); gl.deleteVertexArray(m.vao); }
    c.mesh = null;
  }
  gpuItemMesh(mesh) {
    if (!mesh.gpu) { this.ensureIndices(mesh.count / 4 + 1); mesh.gpu = this.makeTerrainVAO(mesh.data); }
    return mesh.gpu;
  }
  // 아바타 → 스킨 텍스처 층 번호 (0 = 기본 스킨)
  skinLayerFor(av) {
    if (!av) return 0;
    ensureAvatarPixels(av);
    if (!av.pixels) return 0;
    let e = this.skinSlots.get(av.key);
    if (!e) {
      const used = new Set(Array.from(this.skinSlots.values()).map(v => v.layer));
      let layer = -1;
      for (let i = 1; i < this.skinLayers; i++) if (!used.has(i)) { layer = i; break; }
      if (layer < 0) { let old = null; for (const [k, v] of this.skinSlots) if (!old || v.t < old[1].t) old = [k, v]; layer = old[1].layer; this.skinSlots.delete(old[0]); }
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.skinTex);
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, 64, 64, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(av.pixels.buffer.slice(0)));
      e = { layer, t: 0 }; this.skinSlots.set(av.key, e);
    }
    e.t = this.skinFrame;
    return e.layer;
  }
  drawSkinBatch(sb, A, st, vp) {
    const gl = this.gl;
    const pr = this.progs.skin; gl.useProgram(pr.p); this.setCommon(pr, A, st);
    gl.uniformMatrix4fv(pr.u.u_viewProj, false, vp);
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.skinTex);
    gl.uniform1i(pr.u.u_skins, 5);
    gl.activeTexture(gl.TEXTURE0);
    this.ensureIndices(sb.n / 4 + 1);
    gl.bindVertexArray(this.skinVAO);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skinVBO);
    gl.bufferData(gl.ARRAY_BUFFER, sb.f32.subarray(0, sb.n * 14), gl.DYNAMIC_DRAW);
    gl.drawElements(gl.TRIANGLES, sb.n / 4 * 6, gl.UNSIGNED_INT, 0);
    return pr;
  }
  setupShadow(size) {
    const gl = this.gl;
    if (this.shadowTex) { gl.deleteTexture(this.shadowTex); gl.deleteFramebuffer(this.shadowFB); }
    this.shadowSize = size;
    this.shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.shadowFB = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    // 색상 첨부 없이 사용
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  makeRT(w, h, depth) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (this.hdr) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    let dtex = null;
    if (depth) {
      dtex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, dtex);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, w, h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, dtex, 0);
    }
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (st !== gl.FRAMEBUFFER_COMPLETE && this.hdr) { this.hdr = false; gl.bindFramebuffer(gl.FRAMEBUFFER, null); return this.makeRT(w, h, depth); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb, dtex, w, h };
  }
  freeRT(rt) { if (!rt) return; const gl = this.gl; gl.deleteTexture(rt.tex); if (rt.dtex) gl.deleteTexture(rt.dtex); gl.deleteFramebuffer(rt.fb); }
  resize() {
    // 노트북(윈도 배율 125~150%)은 픽셀 수가 1.5~2.3배로 늘어 GPU가 버거움 → 최고 품질이 아니면 배율 1까지만
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr || 2);
    const w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr * this.renderScale));
    const h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr * this.renderScale));
    if (w === this.fbW && h === this.fbH && this.sceneRT) return;
    this.canvas.width = w; this.canvas.height = h;
    this.fbW = w; this.fbH = h;
    this.freeRT(this.sceneRT); this.freeRT(this.brightRT); this.freeRT(this.blurA); this.freeRT(this.blurB);
    this.sceneRT = this.makeRT(w, h, true);
    const bw = Math.max(1, w >> 2), bh = Math.max(1, h >> 2);
    this.brightRT = this.makeRT(bw, bh, false); this.blurA = this.makeRT(bw, bh, false); this.blurB = this.makeRT(bw, bh, false);
  }
  // ------------------------------------------------------------------
  // 대기/조명 색 계산
  computeAtmosphere(world, rain) {
    const t = (world.time % 24000) / 24000;
    const ang = t * Math.PI * 2;
    // 해: 동쪽(+x)에서 떠서 서쪽으로
    const sun = [Math.cos(ang), Math.sin(ang), 0.25];
    const l = Math.hypot(sun[0], sun[1], sun[2]); sun[0] /= l; sun[1] /= l; sun[2] /= l;
    const day = clamp(sun[1] * 3.2 + 0.35, 0, 1);
    const sunset = clamp(1 - Math.abs(sun[1]) * 3.2, 0, 1) * (sun[0] !== 0 ? 1 : 0);
    const A = this.atm || (this.atm = {});
    A.sunPos = sun; A.day = day;
    const moon = [-sun[0], -sun[1], -sun[2]];
    const useSun = sun[1] > -0.05;
    A.lightDir = useSun ? sun : moon;
    const rainK = 1 - rain * 0.6;
    const mixc = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
    let top = mixc([0.03, 0.035, 0.1], [0.22, 0.52, 1.0], day);
    let hor = mixc([0.09, 0.08, 0.2], [0.56, 0.78, 1.0], day);
    hor = mixc(hor, [1.0, 0.62, 0.72], sunset * 0.7);
    top = mixc(top, [0.55, 0.5, 0.85], sunset * 0.35);
    if (rain > 0) { const g = [0.3 * day + 0.02, 0.32 * day + 0.02, 0.36 * day + 0.03]; top = mixc(top, g, rain * 0.8); hor = mixc(hor, g, rain * 0.8); }
    A.skyTop = top; A.skyHor = hor;
    A.sunGlow = [1.2 * sunset + 0.25 * day, 0.55 * sunset + 0.2 * day, 0.2 * sunset + 0.12 * day].map(v => v * rainK);
    const sunStrength = clamp(sun[1] * 4, 0, 1);
    const moonStrength = clamp(-sun[1] * 4, 0, 1);
    A.sunCol = useSun
      ? [lerp(1.2, 1.12, 1 - sunset) * sunStrength, lerp(0.85, 1.05, 1 - sunset) * sunStrength, lerp(0.75, 0.95, 1 - sunset) * sunStrength].map(v => v * rainK * rainK)
      : [0.1 * moonStrength, 0.11 * moonStrength, 0.2 * moonStrength].map(v => v * rainK);
    A.ambCol = mixc([0.12, 0.12, 0.24], [0.6, 0.64, 0.8], day);
    A.ambCol = mixc(A.ambCol, [0.75, 0.55, 0.65], sunset * 0.3);
    A.blockCol = [1.0, 0.8, 0.55];
    A.sunDisk = [1.0, 0.85, 0.6];
    A.waterFog = [0.08 + 0.12 * day, 0.2 + 0.3 * day, 0.3 + 0.4 * day];
    return A;
  }
  setCommon(pr, A, st) {
    const gl = this.gl, u = pr.u;
    if (u.u_skyTop) gl.uniform3fv(u.u_skyTop, A.skyTop);
    if (u.u_skyHor) gl.uniform3fv(u.u_skyHor, A.skyHor);
    if (u.u_sunGlow) gl.uniform3fv(u.u_sunGlow, A.sunGlow);
    if (u.u_sunPos) gl.uniform3fv(u.u_sunPos, A.sunPos);
    if (u.u_lightDir) gl.uniform3fv(u.u_lightDir, A.lightDir);
    if (u.u_sunCol) gl.uniform3fv(u.u_sunCol, A.sunCol);
    if (u.u_ambCol) gl.uniform3fv(u.u_ambCol, A.ambCol);
    if (u.u_blockCol) gl.uniform3fv(u.u_blockCol, A.blockCol);
    if (u.u_fogNear) gl.uniform1f(u.u_fogNear, st.fogNear);
    if (u.u_fogFar) gl.uniform1f(u.u_fogFar, st.fogFar);
    if (u.u_underwater) gl.uniform1f(u.u_underwater, st.underwater ? 1 : 0);
    if (u.u_waterFog) gl.uniform3fv(u.u_waterFog, A.waterFog);
    if (u.u_outScale) gl.uniform1f(u.u_outScale, this.hdr ? 1 : 0.5);
    if (u.u_time) gl.uniform1f(u.u_time, st.time);
    if (u.u_bright) gl.uniform1f(u.u_bright, st.bright || 0);
    if (u.u_dimAmb) gl.uniform3fv(u.u_dimAmb, A.dimAmb || [0, 0, 0]);
  }
  // ------------------------------------------------------------------
  render(st) {
    const gl = this.gl;
    this.resize();
    const w = this.fbW, h = this.fbH;
    const world = st.world;
    const A = this.computeAtmosphere(world, st.rain || 0);
    const cam = st.cam;
    // 카메라 행렬 (카메라 원점 기준)
    const aspect = w / h;
    const far = st.renderDist * 16 + 64;
    M4.perspective(this.proj, st.fov * Math.PI / 180, aspect, 0.05, far);
    const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw), cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
    const fwd = [-sy * cp, sp, -cy * cp];
    M4.lookAt(this.view, [0, 0, 0], fwd, [0, 1, 0]);
    if (st.bob) { const b = M4.create(); M4.translate(b, st.bob[0], st.bob[1], 0); M4.mul(this.view, b, this.view); }
    M4.mul(this.viewProj, this.proj, this.view);
    M4.invert(this.invVP, this.viewProj);
    const planes = frustumPlanes(this.viewProj);
    st.fogFar = (st.renderDist * 16 - 4) * (st.fogScale || 1); st.fogNear = st.fogFar * (st.fogScale ? 0.35 : 0.72);
    if (st.rain) { st.fogNear *= (1 - st.rain * 0.5); }
    // 보이는 청크 목록
    const list = [];
    const ccx = Math.floor(cam[0] / 16), ccz = Math.floor(cam[2] / 16);
    const rd = st.renderDist;
    for (const c of world.chunks.values()) {
      if (!c.mesh) continue;
      const dx = c.cx - ccx, dz = c.cz - ccz;
      if (dx * dx + dz * dz > (rd + 0.5) * (rd + 0.5)) continue;
      const ox = c.cx * 16 - cam[0], oz = c.cz * 16 - cam[2];
      c._rel = [ox, -cam[1], oz];
      c._dist = (ox + 8) * (ox + 8) + (oz + 8) * (oz + 8);
      c._vis = aabbInFrustum(planes, ox, -cam[1], oz, ox + 16, HEIGHT - cam[1], oz + 16);
      list.push(c);
    }
    list.sort((a, b) => a._dist - b._dist);
    // -------- 그림자 패스 --------
    const shadowOn = this.quality >= 1 && A.lightDir[1] > 0.05;
    if (shadowOn) this.renderShadows(st, list, A, cam);
    // -------- 메인 패스 --------
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneRT.fb);
    gl.viewport(0, 0, w, h);
    gl.depthRange(0.01, 1.0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // 하늘
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    let pr = this.progs.sky; gl.useProgram(pr.p);
    this.setCommon(pr, A, st);
    gl.uniformMatrix4fv(pr.u.u_invVP, false, this.invVP);
    gl.uniform1f(pr.u.u_dayF, A.day);
    gl.uniform1f(pr.u.u_clouds, st.clouds ? 1 : 0);
    gl.uniform2f(pr.u.u_camXZ, cam[0], cam[2]); gl.uniform1f(pr.u.u_camY, cam[1]);
    gl.uniform3fv(pr.u.u_sunDisk, A.sunDisk);
    gl.uniform1f(pr.u.u_rain, st.rain || 0);
    gl.bindVertexArray(this.emptyVAO); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LEQUAL);
    // 지형
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.atlas);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    let tris = 0, nch = 0;
    const setupTerrain = (pr) => {
      gl.useProgram(pr.p);
      this.setCommon(pr, A, st);
      gl.uniformMatrix4fv(pr.u.u_viewProj, false, this.viewProj);
      gl.uniformMatrix4fv(pr.u.u_model, false, this.identity);
      gl.uniformMatrix4fv(pr.u.u_shadowMat, false, this.shadowMat);
      gl.uniform3f(pr.u.u_camPos, cam[0], cam[1], cam[2]);
      gl.uniform1i(pr.u.u_atlas, 0); gl.uniform1i(pr.u.u_shadow, 1);
      gl.uniform1f(pr.u.u_shadowOn, shadowOn ? 1 : 0);
      gl.uniform1f(pr.u.u_wind, 1 + (st.rain || 0) * 1.5);
      gl.uniform3f(pr.u.u_entLight, 0, 0, 0);
      gl.uniform1f(pr.u.u_flash, 0);
      if (pr.u.u_alphaMul) gl.uniform1f(pr.u.u_alphaMul, 1);
    };
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    pr = this.progs.opaque; setupTerrain(pr);
    for (const c of list) {
      const m = c.mesh[0]; if (!m || !c._vis) continue;
      gl.uniform3fv(pr.u.u_chunkPos, c._rel);
      gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.count / 4 * 6, gl.UNSIGNED_INT, 0);
      tris += m.count / 2; nch++;
    }
    gl.disable(gl.CULL_FACE);
    pr = this.progs.cutout; setupTerrain(pr);
    for (const c of list) {
      const m = c.mesh[1]; if (!m || !c._vis) continue;
      gl.uniform3fv(pr.u.u_chunkPos, c._rel);
      gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.count / 4 * 6, gl.UNSIGNED_INT, 0);
      tris += m.count / 2;
    }
    // 블록 메시 기반 개체 (아이템, TNT, 떨어지는 블록)
    if (st.blockEnts && st.blockEnts.length) {
      for (const e of st.blockEnts) {
        const g = this.gpuItemMesh(e.mesh);
        gl.uniformMatrix4fv(pr.u.u_model, false, e.model);
        gl.uniform3f(pr.u.u_chunkPos, 0, 0, 0);
        gl.uniform3f(pr.u.u_entLight, e.light[0], e.light[1], 1);
        gl.uniform1f(pr.u.u_flash, e.flash || 0);
        gl.bindVertexArray(g.vao); gl.drawElements(gl.TRIANGLES, e.mesh.count / 4 * 6, gl.UNSIGNED_INT, 0);
      }
      gl.uniformMatrix4fv(pr.u.u_model, false, this.identity);
      gl.uniform3f(pr.u.u_entLight, 0, 0, 0); gl.uniform1f(pr.u.u_flash, 0);
    }
    // 파티클 (지형 형식 동적 버퍼)
    if (st.particles && st.particles.n) {
      this.drawDyn(st.particles, pr, [0, 0, 0]);
    }
    // 개체 (몹, 플레이어)
    if (this.ent.n) {
      pr = this.progs.ent; gl.useProgram(pr.p); this.setCommon(pr, A, st);
      gl.uniformMatrix4fv(pr.u.u_viewProj, false, this.viewProj);
      this.ensureIndices(this.ent.n / 4 + 1);
      gl.bindVertexArray(this.entVAO);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.entVBO);
      gl.bufferData(gl.ARRAY_BUFFER, this.ent.f32.subarray(0, this.ent.n * 14), gl.DYNAMIC_DRAW);
      gl.drawElements(gl.TRIANGLES, this.ent.n / 4 * 6, gl.UNSIGNED_INT, 0);
    }
    if (this.skin.n) this.drawSkinBatch(this.skin, A, st, this.viewProj);
    // 반투명 (물, 얼음) - 멀리서부터
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    pr = this.progs.trans; setupTerrain(pr);
    for (let i = list.length - 1; i >= 0; i--) {
      const c = list[i]; const m = c.mesh[2]; if (!m || !c._vis) continue;
      gl.uniform3fv(pr.u.u_chunkPos, c._rel);
      gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.count / 4 * 6, gl.UNSIGNED_INT, 0);
    }
    // 균열 오버레이
    if (st.crack && st.crack.n) {
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -1);
      this.drawDyn(st.crack, pr, [0, 0, 0]);
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }
    // 비
    if (st.rainBuf && st.rainBuf.n) { gl.uniform1f(pr.u.u_alphaMul, 0.55); this.drawDyn(st.rainBuf, pr, [0, 0, 0]); gl.uniform1f(pr.u.u_alphaMul, 1); }
    gl.depthMask(true);
    // 선택 테두리
    if (st.selLines && st.selLines.length) {
      pr = this.progs.line; gl.useProgram(pr.p);
      gl.uniformMatrix4fv(pr.u.u_viewProj, false, this.viewProj);
      gl.uniform4f(pr.u.u_color, 0, 0, 0, 0.55);
      gl.bindVertexArray(this.lineVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVBO);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(st.selLines), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.LINES, 0, st.selLines.length / 3);
    }
    gl.disable(gl.BLEND);
    // 손 / 들고 있는 아이템
    if (st.hand) this.drawHand(st, A);
    gl.depthRange(0.0, 1.0);
    this.stats.chunks = nch; this.stats.tris = tris;
    // -------- 후처리 --------
    const bloomOn = this.quality >= 2;
    if (bloomOn) this.renderBloom();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.DEPTH_TEST);
    pr = this.progs.post; gl.useProgram(pr.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.sceneRT.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.blurB.tex);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.sceneRT.dtex);
    gl.uniform1i(pr.u.u_scene, 0); gl.uniform1i(pr.u.u_bloom, 1); gl.uniform1i(pr.u.u_depth, 2);
    // 해의 화면 위치
    const sp4 = [A.sunPos[0], A.sunPos[1], A.sunPos[2], 0];
    const clip = [0, 0, 0, 0];
    for (let r = 0; r < 4; r++) clip[r] = this.viewProj[r] * sp4[0] + this.viewProj[4 + r] * sp4[1] + this.viewProj[8 + r] * sp4[2];
    let rays = 0;
    if (clip[3] > 0 && this.quality >= 2 && !st.underwater) {
      const sx = clip[0] / clip[3] * 0.5 + 0.5, sy = clip[1] / clip[3] * 0.5 + 0.5;
      gl.uniform2f(pr.u.u_sunUV, sx, sy);
      const onScreen = 1 - smoothstep(0.6, 1.3, Math.max(Math.abs(sx - 0.5), Math.abs(sy - 0.5)) * 2);
      rays = onScreen * clamp(A.sunPos[1] * 3, 0, 1) * 0.55 * (1 - (st.rain || 0));
    }
    gl.uniform1f(pr.u.u_rays, rays);
    gl.uniform3f(pr.u.u_rayCol, 1.0 * (0.6 + A.sunGlow[0]), 0.85 * (0.6 + A.sunGlow[1]), 0.6 * (0.6 + A.sunGlow[2]));
    gl.uniform1f(pr.u.u_bloomOn, bloomOn ? 1 : 0);
    gl.uniform1f(pr.u.u_underwater, st.underwater ? 1 : 0);
    gl.uniform1f(pr.u.u_time, st.time);
    gl.uniform1f(pr.u.u_exposure, st.exposure || 0.86);
    gl.uniform1f(pr.u.u_hdrScale, this.hdr ? 1 : 2);
    gl.uniform1f(pr.u.u_hurt, st.hurt || 0);
    gl.uniform1f(pr.u.u_sat, this.quality >= 1 ? 1.22 : 1.15);
    gl.bindVertexArray(this.emptyVAO); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
    this.ent.reset(); this.skin.reset(); this.skinFrame++;
  }
  drawDyn(mb, pr, rel) {
    const gl = this.gl;
    gl.uniform3fv(pr.u.u_chunkPos, rel);
    this.ensureIndices(mb.n / 4 + 1);
    gl.bindVertexArray(this.dynVAO.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dynVAO.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(mb.buf, 0, mb.n * VSTRIDE), gl.DYNAMIC_DRAW);
    gl.drawElements(gl.TRIANGLES, mb.n / 4 * 6, gl.UNSIGNED_INT, 0);
  }
  renderShadows(st, list, A, cam) {
    const gl = this.gl;
    const L = A.lightDir;
    const R = Math.min(st.renderDist * 16, this.quality >= 2 ? 80 : 56);
    const size = this.shadowSize;
    // 그림자 지도 다시 쓰기: 지형·해 방향·위치가 거의 그대로면 지난 지도를 카메라 이동만큼 옮겨 씀
    // (그림자 패스가 프레임의 30~40%라 노트북에서 가장 큰 절약)
    const sc = this._shC;
    if (sc && this.quality < 3 && sc.gen === this.meshGen && sc.R === R && sc.size === size && sc.tex === this.shadowTex && ++sc.age < 6 &&
      Math.abs(sc.L[0] - L[0]) + Math.abs(sc.L[1] - L[1]) + Math.abs(sc.L[2] - L[2]) < 0.004 &&
      Math.abs(cam[0] - sc.cam[0]) + Math.abs(cam[1] - sc.cam[1]) + Math.abs(cam[2] - sc.cam[2]) < 3) {
      // shadowMat = 옛 shadowVP × 이동(cam - 옛 cam)
      const M = sc.vp, o = this.shadowMat, dx = cam[0] - sc.cam[0], dy = cam[1] - sc.cam[1], dz = cam[2] - sc.cam[2];
      o.set(M);
      for (let r = 0; r < 4; r++) o[12 + r] = M[12 + r] + M[r] * dx + M[4 + r] * dy + M[8 + r] * dz;
      return;
    }
    // 광원 기준 좌표계
    let up = Math.abs(L[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0];
    let rx = up[1] * L[2] - up[2] * L[1], ry = up[2] * L[0] - up[0] * L[2], rz = up[0] * L[1] - up[1] * L[0];
    let rl = Math.hypot(rx, ry, rz); rx /= rl; ry /= rl; rz /= rl;
    const ux = L[1] * rz - L[2] * ry, uy = L[2] * rx - L[0] * rz, uz = L[0] * ry - L[1] * rx;
    const texel = 2 * R / size;
    const cr = cam[0] * rx + cam[1] * ry + cam[2] * rz, cu = cam[0] * ux + cam[1] * uy + cam[2] * uz;
    const dr = Math.floor(cr / texel) * texel - cr, du = Math.floor(cu / texel) * texel - cu;
    const center = [rx * dr + ux * du, ry * dr + uy * du, rz * dr + uz * du];
    const D = 160;
    const eye = [center[0] + L[0] * D, center[1] + L[1] * D, center[2] + L[2] * D];
    const view = M4.create(), proj = M4.create();
    M4.lookAt(view, eye, center, up);
    M4.ortho(proj, -R, R, -R, R, 1, D * 2);
    M4.mul(this.shadowVP, proj, view);
    this.shadowMat.set(this.shadowVP);
    this._shC = { gen: this.meshGen, R, size, tex: this.shadowTex, age: 0, L: L.slice(), cam: cam.slice(), vp: Float32Array.from(this.shadowVP) };
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFB);
    gl.viewport(0, 0, size, size);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.6, 3.0);
    gl.disable(gl.CULL_FACE);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.atlas);
    const rr = (R / 16 + 1.5) * (R / 16 + 1.5) * 256;
    for (let pass = 0; pass < 2; pass++) {
      const pr = pass === 0 ? this.progs.shadow : this.progs.shadowCut;
      gl.useProgram(pr.p);
      gl.uniformMatrix4fv(pr.u.u_viewProj, false, this.shadowVP);
      gl.uniform3f(pr.u.u_camPos, cam[0], cam[1], cam[2]);
      gl.uniform1f(pr.u.u_time, st.time);
      gl.uniform1f(pr.u.u_wind, 1 + (st.rain || 0) * 1.5);
      if (pr.u.u_atlas) gl.uniform1i(pr.u.u_atlas, 0);
      for (const c of list) {
        if (c._dist > rr) continue;
        const m = c.mesh[pass]; if (!m) continue;
        gl.uniform3fv(pr.u.u_chunkPos, c._rel);
        gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.count / 4 * 6, gl.UNSIGNED_INT, 0);
      }
    }
    gl.disable(gl.POLYGON_OFFSET_FILL);
  }
  renderBloom() {
    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(this.emptyVAO);
    let pr = this.progs.bright; gl.useProgram(pr.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.brightRT.fb); gl.viewport(0, 0, this.brightRT.w, this.brightRT.h);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.sceneRT.tex);
    gl.uniform1i(pr.u.u_tex, 0); gl.uniform1f(pr.u.u_threshold, this.hdr ? 1.55 : 0.78);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    pr = this.progs.blur; gl.useProgram(pr.p); gl.uniform1i(pr.u.u_tex, 0);
    let src = this.brightRT;
    for (let i = 0; i < 2; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurA.fb); gl.bindTexture(gl.TEXTURE_2D, src.tex); gl.uniform2f(pr.u.u_dir, 1.5, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurB.fb); gl.bindTexture(gl.TEXTURE_2D, this.blurA.tex); gl.uniform2f(pr.u.u_dir, 0, 1.5); gl.drawArrays(gl.TRIANGLES, 0, 3);
      src = this.blurB;
    }
    gl.enable(gl.DEPTH_TEST);
  }
  // 1인칭 손/아이템
  drawHand(st, A) {
    const gl = this.gl, h = st.hand;
    gl.depthRange(0.0, 0.01);
    this._drawHandInner(st, A, h);
    gl.depthRange(0.0, 1.0);
  }
  _drawHandInner(st, A, h) {
    const gl = this.gl;
    const proj = M4.create(); M4.perspective(proj, 70 * Math.PI / 180, this.fbW / this.fbH, 0.02, 10);
    // 손 위치 (카메라 공간) - 흔들림/휘두르기 애니메이션
    const sw = h.swing || 0;
    const s1 = Math.sin(sw * Math.PI), s2 = Math.sin(Math.sqrt(sw) * Math.PI);
    const bobX = h.bob ? h.bob[0] : 0, bobY = h.bob ? h.bob[1] : 0;
    const m = M4.create(), t = M4.create();
    if (h.mesh) {
      const flat = h.flat;
      M4.translate(m, 0.56 + bobX - s2 * 0.25, -0.52 + bobY + s2 * 0.2 - (h.equip || 0) * 0.5, -0.9 - s1 * 0.1);
      M4.mul(m, m, M4.rotY(t, flat ? -1.2 + s2 * 0.6 : 0.78 + s2 * 0.5));
      M4.mul(m, m, M4.rotX(t, -s1 * 1.1 + (flat ? 0.1 : 0)));
      if (flat) M4.mul(m, m, M4.rotZ(t, 0.35));
      const sc = flat ? 0.55 : 0.4; const sm = M4.create(); sm[0] = sm[5] = sm[10] = sc;
      M4.mul(m, m, sm);
      const vp = proj;
      const pr = this.progs.cutout; gl.useProgram(pr.p);
      this.setCommon(pr, A, st);
      gl.uniformMatrix4fv(pr.u.u_viewProj, false, vp);
      gl.uniformMatrix4fv(pr.u.u_model, false, m);
      gl.uniformMatrix4fv(pr.u.u_shadowMat, false, this.shadowMat);
      gl.uniform3f(pr.u.u_chunkPos, 0, 0, 0);
      gl.uniform3f(pr.u.u_camPos, 0, 0, 0);
      gl.uniform1f(pr.u.u_shadowOn, 0);
      gl.uniform3f(pr.u.u_entLight, h.light[0], h.light[1], 1);
      gl.uniform1f(pr.u.u_flash, 0);
      gl.uniform1f(pr.u.u_fogFar, 1000); gl.uniform1f(pr.u.u_fogNear, 999);
      gl.uniform1f(pr.u.u_wind, 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.atlas);
      gl.uniform1i(pr.u.u_atlas, 0);
      const g = this.gpuItemMesh(h.mesh);
      gl.bindVertexArray(g.vao); gl.drawElements(gl.TRIANGLES, h.mesh.count / 4 * 6, gl.UNSIGNED_INT, 0);
      gl.uniformMatrix4fv(pr.u.u_model, false, this.identity);
      gl.uniform3f(pr.u.u_entLight, 0, 0, 0);
    } else {
      // 맨손 (팔)
      if (h.av) {
        M4.translate(m, 0.62 + bobX - s2 * 0.3, -0.62 + bobY + s2 * 0.25, -0.75 - s1 * 0.15);
        M4.mul(m, m, M4.rotX(t, 1.25 - s1 * 1.2));
        M4.mul(m, m, M4.rotY(t, -0.35 + s2 * 0.4));
        const tr = M4.create(); M4.translate(tr, 0, 0, 0.125); M4.mul(m, m, tr); M4.mul(m, m, M4.rotX(t, Math.PI / 2));
        const sb = this._handSkin || (this._handSkin = new SkinBatch()); sb.reset();
        const layer = this.skinLayerFor(h.av), slim = !!h.av.slim, B = avatarBoxes(slim).rarm;
        sb.addPart(m, 'rarm', 0, slim, B, layer, h.light[0], h.light[1], [1, 1, 1]);
        sb.addPart(m, 'rarm', 1, slim, inflateBox(B, 0.25 / 16), layer, h.light[0], h.light[1], [1, 1, 1]);
        const pr = this.drawSkinBatch(sb, A, st, proj);
        return;
      }
      const eb = new EntityBatch();
      M4.translate(m, 0.62 + bobX - s2 * 0.3, -0.62 + bobY + s2 * 0.25, -0.75 - s1 * 0.15);
      M4.mul(m, m, M4.rotX(t, 1.25 - s1 * 1.2));
      M4.mul(m, m, M4.rotY(t, -0.35 + s2 * 0.4));
      eb.addBox(m, -0.1, -0.1, -0.5, 0.1, 0.1, 0.25, h.skin || [0.87, 0.67, 0.53], h.light[0], h.light[1]);
      const pr = this.progs.ent; gl.useProgram(pr.p); this.setCommon(pr, A, st);
      gl.uniformMatrix4fv(pr.u.u_viewProj, false, proj);
      gl.uniform1f(pr.u.u_fogFar, 1000); gl.uniform1f(pr.u.u_fogNear, 999);
      gl.bindVertexArray(this.entVAO); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.entVBO);
      gl.bufferData(gl.ARRAY_BUFFER, eb.f32.subarray(0, eb.n * 14), gl.DYNAMIC_DRAW);
      gl.drawElements(gl.TRIANGLES, eb.n / 4 * 6, gl.UNSIGNED_INT, 0);
    }
  }
  // 화면 좌표 투영 (이름표용)
  project(rel) {
    const m = this.viewProj;
    const x = m[0] * rel[0] + m[4] * rel[1] + m[8] * rel[2] + m[12];
    const y = m[1] * rel[0] + m[5] * rel[1] + m[9] * rel[2] + m[13];
    const w = m[3] * rel[0] + m[7] * rel[1] + m[11] * rel[2] + m[15];
    if (w <= 0.1) return null;
    return [(x / w * 0.5 + 0.5) * this.canvas.clientWidth, (1 - (y / w * 0.5 + 0.5)) * this.canvas.clientHeight, w];
  }
}

// 색상 상자 모음 (몹/플레이어)
class EntityBatch {
  constructor() { this.cap = 4096; this.f32 = new Float32Array(this.cap * 14); this.n = 0; this.tmp = [0, 0, 0]; }
  reset() { this.n = 0; }
  _grow() { const nf = new Float32Array(this.cap * 2 * 14); nf.set(this.f32); this.f32 = nf; this.cap *= 2; }
  // m: 카메라 기준 변환 행렬, 상자 좌표는 로컬
  addBox(m, x0, y0, z0, x1, y1, z1, col, sky, blk) {
    if (this.n + 24 > this.cap) this._grow();
    const f = this.f32;
    for (let face = 0; face < 6; face++) {
      const F = FACES[face];
      const nx = F.n[0], ny = F.n[1], nz = F.n[2];
      const wn = [m[0] * nx + m[4] * ny + m[8] * nz, m[1] * nx + m[5] * ny + m[9] * nz, m[2] * nx + m[6] * ny + m[10] * nz];
      const l = Math.hypot(wn[0], wn[1], wn[2]) || 1;
      for (let k = 0; k < 4; k++) {
        const c = F.pts[k];
        const px = c[0] ? x1 : x0, py = c[1] ? y1 : y0, pz = c[2] ? z1 : z0;
        const o = this.n * 14;
        f[o] = m[0] * px + m[4] * py + m[8] * pz + m[12];
        f[o + 1] = m[1] * px + m[5] * py + m[9] * pz + m[13];
        f[o + 2] = m[2] * px + m[6] * py + m[10] * pz + m[14];
        f[o + 3] = wn[0] / l; f[o + 4] = wn[1] / l; f[o + 5] = wn[2] / l;
        f[o + 6] = col[0]; f[o + 7] = col[1]; f[o + 8] = col[2];
        f[o + 9] = sky; f[o + 10] = blk;
        f[o + 11] = px; f[o + 12] = py; f[o + 13] = pz;
        this.n++;
      }
    }
  }
}
