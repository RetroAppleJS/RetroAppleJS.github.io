/*
 * DualHGR WebAssembly byte-pair quantizer.
 * Freestanding C99: no host imports, no filesystem, no browser access.
 * Each invocation consumes 280x192 RGB and precomputed 16x16 mixed-color LUTs,
 * and exports two native 8192-byte HGR images plus an RGB composite preview.
 * Artifact decoder reproduces res/EMU_DEVICE_video_WebGPU.js color rules.
 * Build:
 * clang --target=wasm32 -O3 -ffreestanding -fno-builtin -nostdlib \
 *   -Wl,--no-entry -Wl,--export-memory -Wl,--initial-memory=1048576 \
 *   -Wl,--max-memory=1048576 -Wl,--strip-all -o dualhgr_optimizer.wasm dualhgr_wasm.c
 */
#include <stdint.h>
#define W 280
#define H 192
#define COLS 40
#define RGBSIZE (W*H*3)
#define PAGESIZE 8192
#define NMODEL (16*16*3)
static uint8_t source_rgb[RGBSIZE];
static float mixed_rgb[NMODEL];
static float mixed_yuv[NMODEL];
static float instability[256];
static uint8_t page1[PAGESIZE], page2[PAGESIZE], preview[RGBSIZE];
static float err[(W+2)*3], next_err[(W+2)*3], target[W*3];
static uint8_t A[COLS], B[COLS], artifact_lut[32];
static double rmse, objective, color_mse;
static const uint8_t bayer[16]={0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5};

__attribute__((export_name("source_ptr"))) uintptr_t source_ptr(void){return (uintptr_t)source_rgb;}
__attribute__((export_name("rgb_ptr"))) uintptr_t rgb_ptr(void){return (uintptr_t)mixed_rgb;}
__attribute__((export_name("yuv_ptr"))) uintptr_t yuv_ptr(void){return (uintptr_t)mixed_yuv;}
__attribute__((export_name("penalty_ptr"))) uintptr_t penalty_ptr(void){return (uintptr_t)instability;}
__attribute__((export_name("page1_ptr"))) uintptr_t page1_ptr(void){return (uintptr_t)page1;}
__attribute__((export_name("page2_ptr"))) uintptr_t page2_ptr(void){return (uintptr_t)page2;}
__attribute__((export_name("preview_ptr"))) uintptr_t preview_ptr(void){return (uintptr_t)preview;}
__attribute__((export_name("rmse"))) double get_rmse(void){return rmse;}
__attribute__((export_name("objective"))) double get_objective(void){return objective;}
__attribute__((export_name("color_mse"))) double get_color_mse(void){return color_mse;}

static inline double clamp(double x,double lo,double hi){return x<lo?lo:(x>hi?hi:x);}
static inline int c_at(const uint8_t *line, int x){
  if(x<0||x>=W)return 0;
  int col=x/7, bit=x-7*col;
  uint8_t word=line[col];
  int left=bit==0?(col?((line[col-1]>>6)&1):0):((word>>(bit-1))&1);
  int me=(word>>bit)&1;
  int right=bit==6?(col<COLS-1?(line[col+1]&1):0):((word>>(bit+1))&1);
  return artifact_lut[(((word>>7)*2+(x&1))*8)+left+(me<<1)+(right<<2)];
}
static void init_lut(void){
  for(int phase=0;phase<2;phase++)for(int parity=0;parity<2;parity++)for(int bits=0;bits<8;bits++){
    int white=(200>>bits)&1, colored=(36>>bits)&1;
    int phase_index=1+((((parity^bits)<<1)&2)|(((parity^bits)&1)^phase));
    artifact_lut[(phase*2+parity)*8+bits]=white?15:(colored?phase_index*3:0);
  }
}
static inline double score(const uint8_t *a,const uint8_t *b,int col,double luma){
  double total=0;
  int lo=col*7-1;if(lo<0)lo=0;
  int hi=col*7+7;if(hi>=W)hi=W-1;
  for(int x=lo;x<=hi;x++){
    int pair=c_at(a,x)*16+c_at(b,x), po=pair*3, tx=x*3;
    double dy=(double)target[tx]-mixed_yuv[po];
    double du=(double)target[tx+1]-mixed_yuv[po+1];
    double dv=(double)target[tx+2]-mixed_yuv[po+2];
    total+=luma*dy*dy+du*du+dv*dv+instability[pair];
  }
  return total;
}
static void choose_byte(uint8_t *a,uint8_t *b,int layer,int col,double luma){
  uint8_t *line=layer?b:a, best=line[col];
  double best_score=1.e300;
  for(int pattern=0;pattern<256;pattern++){
    line[col]=(uint8_t)pattern;
    double cost=score(a,b,col,luma);
    if(cost<best_score){best_score=cost;best=(uint8_t)pattern;}
  }
  line[col]=best;
}
/* Small stable shortlist, padded with original phase-toggle and common patterns. */
static int shortlist(uint8_t *a,uint8_t *b,int layer,int col,double luma,int width,uint8_t out[40]){
  uint8_t *line=layer?b:a, original=line[col], pat[32];
  double costs[32];int count=0;
  for(int p=0;p<256;p++){
    line[col]=(uint8_t)p;
    double cost=score(a,b,col,luma);
    if(count==width&&cost>=costs[count-1])continue;
    int k=count;
    while(k>0&&cost<costs[k-1])k--;
    int len=count<width?count+1:width;
    for(int j=len-1;j>k;j--){costs[j]=costs[j-1];pat[j]=pat[j-1];}
    if(k<width){costs[k]=cost;pat[k]=(uint8_t)p;}
    count=len;
  }
  line[col]=original;
  for(int i=0;i<count;i++)out[i]=pat[i];
  const uint8_t extra[8]={original,(uint8_t)(original^128),0,127,128,255,0x55,0xaa};
  for(int i=0;i<8;i++){
    int present=0;
    for(int j=0;j<count;j++)if(out[j]==extra[i]){present=1;break;}
    if(!present)out[count++]=extra[i];
  }
  return count;
}
static void choose_pair(uint8_t *a,uint8_t *b,int col,double luma,int width){
  uint8_t pa[40],pb[40];
  int na=shortlist(a,b,0,col,luma,width,pa);
  int nb=shortlist(a,b,1,col,luma,width,pb);
  uint8_t best_a=a[col],best_b=b[col];
  double best=score(a,b,col,luma);
  for(int i=0;i<na;i++){
    a[col]=pa[i];
    for(int j=0;j<nb;j++){
      b[col]=pb[j];
      double cost=score(a,b,col,luma);
      if(cost<best){best=cost;best_a=pa[i];best_b=pb[j];}
    }
  }
  a[col]=best_a;b[col]=best_b;
}
static inline int memory_offset(int y,int col){
  return ((y&7)<<10)+((y&0x38)<<4)+((y>>6)*40)+col;
}
static void metric(double r,double g,double b, float *out){
  out[0]=(float)(.299*r+.587*g+.114*b);
  out[1]=(float)(.500*r-.419*g-.081*b);
  out[2]=(float)(-.169*r-.331*g+.500*b);
}
/* all quantization, ordered dithering, byte-pair refinement, diffusion and packing */
__attribute__((export_name("convert"))) int convert(int passes,int candidates,double ordered,double diffusion,double luma){
  if(passes<0||passes>10||candidates<0||candidates>32||ordered<0||diffusion<0||luma<0)return -1;
  init_lut();
  double sum_rgb=0,sum_metric=0,sum_penalty=0;
  for(int i=0;i<(W+2)*3;i++)err[i]=0;
  for(int i=0;i<PAGESIZE;i++)page1[i]=page2[i]=0;
  for(int y=0;y<H;y++){
    for(int i=0;i<COLS;i++)A[i]=B[i]=0;
    for(int i=0;i<(W+2)*3;i++)next_err[i]=0;
    for(int x=0;x<W;x++){
      int si=(y*W+x)*3, to=x*3, eo=(x+1)*3;
      double bias=ordered*(((bayer[((y&3)*4)+(x&3)]+.5)/16.)-.5);
      metric(clamp(source_rgb[si]+diffusion*err[eo]+bias,0,255),
             clamp(source_rgb[si+1]+diffusion*err[eo+1]+bias,0,255),
             clamp(source_rgb[si+2]+diffusion*err[eo+2]+bias,0,255),target+to);
    }
    float carry[3]={0,0,0};
    for(int col=0;col<COLS;col++){
      int x0=col*7;
      for(int x=x0;x<x0+7;x++)for(int c=0;c<3;c++)target[x*3+c]=(float)((double)target[x*3+c]+carry[c]);
      choose_byte(A,B,0,col,luma);
      choose_byte(A,B,1,col,luma);
      choose_byte(A,B,0,col,luma);
      for(int c=0;c<3;c++)carry[c]=0;
      for(int x=x0;x<x0+7;x++){
        int p=(c_at(A,x)*16+c_at(B,x))*3,o=x*3;
        for(int c=0;c<3;c++)carry[c]=(float)(carry[c]+((double)target[o+c]-mixed_yuv[p+c]));
      }
      for(int c=0;c<3;c++)carry[c]=(float)clamp(carry[c]*(7./16./7.),-25,25);
    }
    for(int pass=0;pass<passes;pass++){
      int reverse=pass&1;
      for(int i=0;i<COLS;i++){
        int col=reverse?COLS-1-i:i;
        choose_byte(A,B,0,col,luma);
        choose_byte(A,B,1,col,luma);
        if(candidates)choose_pair(A,B,col,luma,candidates);
      }
    }
    for(int col=0;col<COLS;col++){
      int off=memory_offset(y,col);
      page1[off]=A[col];page2[off]=B[col];
    }
    for(int x=0;x<W;x++){
      int po=(y*W+x)*3,pair=c_at(A,x)*16+c_at(B,x), mix=pair*3;
      for(int c=0;c<3;c++){
        double made=mixed_rgb[mix+c], wanted=source_rgb[po+c];
        /* JS Math.round(x) for positive [0,255] is floor(x+.5). */
        preview[po+c]=(uint8_t)(made+.5);
        double delta=wanted-made;
        sum_rgb+=delta*delta;
        double e=clamp(err[(x+1)*3+c]*diffusion+delta,-96,96);
        next_err[x*3+c]=(float)(next_err[x*3+c]+e*(3./16.));
        next_err[(x+1)*3+c]=(float)(next_err[(x+1)*3+c]+e*(5./16.));
        next_err[(x+2)*3+c]=(float)(next_err[(x+2)*3+c]+e*(1./16.));
      }
      float actual[3];metric(source_rgb[po],source_rgb[po+1],source_rgb[po+2],actual);
      double dy=(double)actual[0]-mixed_yuv[mix];
      double du=(double)actual[1]-mixed_yuv[mix+1];
      double dv=(double)actual[2]-mixed_yuv[mix+2];
      sum_metric+=luma*dy*dy+du*du+dv*dv;
      sum_penalty+=instability[pair];
    }
    for(int i=0;i<(W+2)*3;i++)err[i]=next_err[i];
  }
  rmse=__builtin_sqrt(sum_rgb/(W*H*3.));
  color_mse=sum_metric/(W*H);
  objective=(sum_metric+sum_penalty)/(W*H);
  return 0;
}
