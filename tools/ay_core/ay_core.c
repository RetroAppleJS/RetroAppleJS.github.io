/* Scalar port of the project's Ayumi JS algorithm. Original authors:
 * Peter Sovietov & Alexander Kovalenko. Attribution: NOTICE.md.
 * Float64 DSP; no fast-math, contraction, imports or render allocations. */
#include "ay_core.h"
#define MAX_INSTANCES 16
#define MEMORY_BYTES 2097152u
#define SAFE_TICK 9007199254740991ull
#define E_ARGUMENT -1
#define E_HANDLE -2
#define E_TIME -3
#define E_ORDER -4
#define E_CAPACITY -5
#define E_MEMORY -6
#define E_STATE -7
#define E_PHASE -8
static void zero(void *dest, uint32_t n)
{
    uint8_t *d = dest;
    while (n--)
        *d++ = 0;
}
static void copy(void *dest, const void *src, uint32_t n)
{
    uint8_t *d = dest;
    const uint8_t *s = src;
    while (n--)
        *d++ = *s++;
}
void *memset(void *dest, int value, unsigned long n)
{
    uint8_t *d = dest;
    for (unsigned long i = 0; i < n; i++)
        d[i] = (uint8_t)value;
    return dest;
}
void *memcpy(void *dest, const void *src, unsigned long n)
{
    copy(dest, src, (uint32_t)n);
    return dest;
}
static uint32_t align8(uint32_t n)
{
    return (n + 7u) & ~7u;
}
static int finite(double x)
{
    return x == x && x <= 1.7976931348623157e308 && x >= -1.7976931348623157e308;
}
static int tick_ok(double x)
{
    return finite(x) && x >= 0 && x <= SAFE_TICK && (double)(uint64_t)x == x;
}
static const uint8_t masks[14] = {255, 15, 255, 15, 255, 15, 31, 255, 31, 31, 31, 255, 255, 15};
static const double AY_DAC_TABLE[32] = {0.0,
                                        0.0,
                                        0.00999465934234,
                                        0.00999465934234,
                                        0.0144502937362,
                                        0.0144502937362,
                                        0.0210574502174,
                                        0.0210574502174,
                                        0.0307011520562,
                                        0.0307011520562,
                                        0.0455481803616,
                                        0.0455481803616,
                                        0.0644998855573,
                                        0.0644998855573,
                                        0.107362478065,
                                        0.107362478065,
                                        0.126588845655,
                                        0.126588845655,
                                        0.20498970016,
                                        0.20498970016,
                                        0.292210269322,
                                        0.292210269322,
                                        0.372838941024,
                                        0.372838941024,
                                        0.492530708782,
                                        0.492530708782,
                                        0.635324635691,
                                        0.635324635691,
                                        0.805584802014,
                                        0.805584802014,
                                        1.0,
                                        1.0};
static const double YM_DAC_TABLE[32] = {0.0,
                                        0.0,
                                        0.00465400167849,
                                        0.00772106507973,
                                        0.0109559777218,
                                        0.0139620050355,
                                        0.0169985503929,
                                        0.0200198367285,
                                        0.024368657969,
                                        0.029694056611,
                                        0.0350652323186,
                                        0.0403906309606,
                                        0.0485389486534,
                                        0.0583352407111,
                                        0.0680552376593,
                                        0.0777752346075,
                                        0.0925154497597,
                                        0.111085679408,
                                        0.129747463188,
                                        0.148485542077,
                                        0.17666895552,
                                        0.211551079576,
                                        0.246387426566,
                                        0.281101701381,
                                        0.333730067903,
                                        0.400427252613,
                                        0.467383840696,
                                        0.53443198291,
                                        0.635172045472,
                                        0.75800717174,
                                        0.879926756695,
                                        1.0};

typedef struct
{
    uint32_t toneCounter, tonePeriod, tone, tOff, nOff, eOn, volume;
    double panLeft, panRight;
} Channel;
typedef struct
{
    Channel channels[3];
    uint32_t model, clockHz;
    uint8_t regs[14];
    uint32_t noisePeriod, noiseCounter, noise, envelopeCounter, envelopePeriod, envelopeShape,
        envelopeSegment, envelope;
    double step, x, left, right, cLeft[4], yLeft[4], cRight[4], yRight[4];
    double firLeft[384], firRight[384], dcLeft[1024], dcRight[1024], dcSumLeft, dcSumRight;
    uint32_t firIndex, dcIndex;
} Chip;
static const uint8_t shapes[16][2] = {{0, 2}, {0, 2}, {0, 2}, {0, 2}, {1, 2}, {1, 2},
                                      {1, 2}, {1, 2}, {0, 0}, {0, 2}, {0, 1}, {0, 3},
                                      {1, 1}, {1, 3}, {1, 0}, {1, 2}};
static void reset_segment(Chip *p)
{
    uint32_t f = shapes[p->envelopeShape][p->envelopeSegment];
    p->envelope = (f == 0 || f == 3) ? 31 : 0;
}
static void reset_digital(Chip *p)
{
    zero(p->regs, 14);
    for (int i = 0; i < 3; i++)
    {
        Channel *c = &p->channels[i];
        c->toneCounter = c->tone = c->tOff = c->nOff = c->eOn = c->volume = 0;
        c->tonePeriod = 1;
    }
    p->noisePeriod = p->noiseCounter = p->envelopeCounter = p->envelopeShape = p->envelopeSegment =
        0;
    p->noise = 1;
    p->envelopePeriod = 1;
    reset_segment(p);
}
static void write_reg(Chip *p, uint32_t reg, uint32_t value)
{
    uint8_t *r = p->regs;
    r[reg] = value & masks[reg];
    if (reg < 6)
    {
        uint32_t i = reg / 2, period = ((uint32_t)r[i * 2 + 1] << 8) | r[i * 2];
        p->channels[i].tonePeriod = period ? period : 1;
    }
    else if (reg == 6)
        p->noisePeriod = r[6];
    else if (reg >= 7 && reg <= 10)
    {
        for (int i = 0; i < 3; i++)
        {
            Channel *c = &p->channels[i];
            c->tOff = (r[7] >> i) & 1;
            c->nOff = (r[7] >> (i + 3)) & 1;
            c->eOn = r[8 + i] >> 4;
            c->volume = r[8 + i] & 15;
        }
    }
    else if (reg == 11 || reg == 12)
    {
        uint32_t period = ((uint32_t)r[12] << 8) | r[11];
        p->envelopePeriod = period ? period : 1;
    }
    else if (reg == 13)
    {
        p->envelopeShape = r[13];
        p->envelopeCounter = p->envelopeSegment = 0;
        reset_segment(p);
    }
}
static void update_mixer(Chip *p)
{
    if (++p->noiseCounter >= p->noisePeriod * 2)
    {
        p->noiseCounter = 0;
        uint32_t bit = (p->noise ^ (p->noise >> 3)) & 1;
        p->noise = (p->noise >> 1) | (bit << 16);
    }
    uint32_t noise = p->noise & 1;
    if (++p->envelopeCounter >= p->envelopePeriod)
    {
        p->envelopeCounter = 0;
        uint32_t f = shapes[p->envelopeShape][p->envelopeSegment];
        if (f == 0)
        {
            if (p->envelope == 0)
            {
                p->envelopeSegment ^= 1;
                reset_segment(p);
            }
            else
                p->envelope--;
        }
        else if (f == 1)
        {
            if (++p->envelope > 31)
            {
                p->envelopeSegment ^= 1;
                reset_segment(p);
            }
        }
    }
    p->left = p->right = 0;
    const double *dac = p->model ? YM_DAC_TABLE : AY_DAC_TABLE;
    for (int i = 0; i < 3; i++)
    {
        Channel *c = &p->channels[i];
        if (++c->toneCounter >= c->tonePeriod)
        {
            c->toneCounter = 0;
            c->tone ^= 1;
        }
        uint32_t out = (c->tone | c->tOff) & (noise | c->nOff);
        out *= c->eOn ? p->envelope : c->volume * 2 + 1;
        p->left += dac[out] * c->panLeft;
        p->right += dac[out] * c->panRight;
    }
}
static double decimate(double *x)
{
    double y =
        -0.0000046183113992051936 * (x[1] + x[191]) + -0.00001117761640887225 * (x[2] + x[190]) +
        -0.000018610264502005432 * (x[3] + x[189]) + -0.000025134586135631012 * (x[4] + x[188]) +
        -0.000028494281690666197 * (x[5] + x[187]) + -0.000026396828793275159 * (x[6] + x[186]) +
        -0.000017094212558802156 * (x[7] + x[185]) + 0.000023798193576966866 * (x[9] + x[183]) +
        0.000051281160242202183 * (x[10] + x[182]) + 0.00007762197826243427 * (x[11] + x[181]) +
        0.000096759426664120416 * (x[12] + x[180]) + 0.00010240229300393402 * (x[13] + x[179]) +
        0.000089344614218077106 * (x[14] + x[178]) + 0.000054875700118949183 * (x[15] + x[177]) +
        -0.000069839082210680165 * (x[17] + x[175]) + -0.0001447966132360757 * (x[18] + x[174]) +
        -0.00021158452917708308 * (x[19] + x[173]) + -0.00025535069106550544 * (x[20] + x[172]) +
        -0.00026228714374322104 * (x[21] + x[171]) + -0.00022258805927027799 * (x[22] + x[170]) +
        -0.00013323230495695704 * (x[23] + x[169]) + 0.00016182578767055206 * (x[25] + x[167]) +
        0.00032846175385096581 * (x[26] + x[166]) + 0.00047045611576184863 * (x[27] + x[165]) +
        0.00055713851457530944 * (x[28] + x[164]) + 0.00056212565121518726 * (x[29] + x[163]) +
        0.00046901918553962478 * (x[30] + x[162]) + 0.00027624866838952986 * (x[31] + x[161]) +
        -0.00032564179486838622 * (x[33] + x[159]) + -0.00065182310286710388 * (x[34] + x[158]) +
        -0.00092127787309319298 * (x[35] + x[157]) + -0.0010772534348943575 * (x[36] + x[156]) +
        -0.0010737727700273478 * (x[37] + x[155]) + -0.00088556645390392634 * (x[38] + x[154]) +
        -0.00051581896090765534 * (x[39] + x[153]) + 0.00059548767193795277 * (x[41] + x[151]) +
        0.0011803558710661009 * (x[42] + x[150]) + 0.0016527320270369871 * (x[43] + x[149]) +
        0.0019152679330965555 * (x[44] + x[148]) + 0.0018927324805381538 * (x[45] + x[147]) +
        0.0015481870327877937 * (x[46] + x[146]) + 0.00089470695834941306 * (x[47] + x[145]) +
        -0.0010178225878206125 * (x[49] + x[143]) + -0.0020037400552054292 * (x[50] + x[142]) +
        -0.0027874356824117317 * (x[51] + x[141]) + -0.003210329988021943 * (x[52] + x[140]) +
        -0.0031540624117984395 * (x[53] + x[139]) + -0.0025657163651900345 * (x[54] + x[138]) +
        -0.0014750752642111449 * (x[55] + x[137]) + 0.0016624165446378462 * (x[57] + x[135]) +
        0.0032591192839069179 * (x[58] + x[134]) + 0.0045165685815867747 * (x[59] + x[133]) +
        0.0051838984346123896 * (x[60] + x[132]) + 0.0050774264697459933 * (x[61] + x[131]) +
        0.0041192521414141585 * (x[62] + x[130]) + 0.0023628575417966491 * (x[63] + x[129]) +
        -0.0026543507866759182 * (x[65] + x[127]) + -0.0051990251084333425 * (x[66] + x[126]) +
        -0.0072020238234656924 * (x[67] + x[125]) + -0.0082672928192007358 * (x[68] + x[124]) +
        -0.0081033739572956287 * (x[69] + x[123]) + -0.006583111539570221 * (x[70] + x[122]) +
        -0.0037839040415292386 * (x[71] + x[121]) + 0.0042781252851152507 * (x[73] + x[119]) +
        0.0084176358598320178 * (x[74] + x[118]) + 0.01172566057463055 * (x[75] + x[117]) +
        0.013550476647788672 * (x[76] + x[116]) + 0.013388189369997496 * (x[77] + x[115]) +
        0.010979501242341259 * (x[78] + x[114]) + 0.006381274941685413 * (x[79] + x[113]) +
        -0.007421229604153888 * (x[81] + x[111]) + -0.01486456304340213 * (x[82] + x[110]) +
        -0.021143584622178104 * (x[83] + x[109]) + -0.02504275058758609 * (x[84] + x[108]) +
        -0.025473530942547201 * (x[85] + x[107]) + -0.021627310017882196 * (x[86] + x[106]) +
        -0.013104323383225543 * (x[87] + x[105]) + 0.017065133989980476 * (x[89] + x[103]) +
        0.036978919264451952 * (x[90] + x[102]) + 0.05823318062093958 * (x[91] + x[101]) +
        0.079072012081405949 * (x[92] + x[100]) + 0.097675998716952317 * (x[93] + x[99]) +
        0.11236045936950932 * (x[94] + x[98]) + 0.12176343577287731 * (x[95] + x[97]) +
        0.125 * x[96];
    for (int i = 0; i < 8; i++)
    {
        x[192 - 8 + i] = x[i];
    }
    return y;
}
static void process(Chip *p)
{
    double *cl = p->cLeft, *yl = p->yLeft, *cr = p->cRight, *yr = p->yRight;
    uint32_t offset = 192 - p->firIndex * 8;
    double *fl = p->firLeft + offset, *fr = p->firRight + offset;
    p->firIndex = (p->firIndex + 1) % 23;
    for (int i = 7; i >= 0; i--)
    {
        p->x += p->step;
        if (p->x >= 1)
        {
            p->x--;
            yl[0] = yl[1];
            yl[1] = yl[2];
            yl[2] = yl[3];
            yr[0] = yr[1];
            yr[1] = yr[2];
            yr[2] = yr[3];
            update_mixer(p);
            yl[3] = p->left;
            yr[3] = p->right;
            double y1 = yl[2] - yl[0];
            cl[0] = 0.5 * yl[1] + 0.25 * (yl[0] + yl[2]);
            cl[1] = 0.5 * y1;
            cl[2] = 0.25 * (yl[3] - yl[1] - y1);
            y1 = yr[2] - yr[0];
            cr[0] = 0.5 * yr[1] + 0.25 * (yr[0] + yr[2]);
            cr[1] = 0.5 * y1;
            cr[2] = 0.25 * (yr[3] - yr[1] - y1);
        }
        fl[i] = (cl[2] * p->x + cl[1]) * p->x + cl[0];
        fr[i] = (cr[2] * p->x + cr[1]) * p->x + cr[0];
    }
    p->left = decimate(fl);
    p->right = decimate(fr);
    p->dcSumLeft += -p->dcLeft[p->dcIndex] + p->left;
    p->dcLeft[p->dcIndex] = p->left;
    p->left -= p->dcSumLeft / 1024;
    p->dcSumRight += -p->dcRight[p->dcIndex] + p->right;
    p->dcRight[p->dcIndex] = p->right;
    p->right -= p->dcSumRight / 1024;
    p->dcIndex = (p->dcIndex + 1) & 1023;
}
typedef struct
{
    uint32_t size, abi, chipCount, timebaseHz, sampleRate, maxFrames, maxEvents, flags;
    double origin;
} Config;
typedef struct
{
    Config config;
    uint64_t tick, origin, frames;
    uint32_t phase, advanced;
    Chip chips[2];
} State;
typedef struct
{
    uint32_t generation, base, size, eventPtr, leftPtr, rightPtr, controlPtr, statePtr;
    State *state;
} Slot;
static Slot slots[MAX_INSTANCES];
static Config setup __attribute__((aligned(8)));
extern unsigned char __heap_base;
static uint32_t state_bytes(void)
{
    return 28 + sizeof(State);
}
static Slot *get(int32_t h)
{
    if (h <= 0)
        return 0;
    uint32_t i = ((uint32_t)h & 31u) - 1u, g = (uint32_t)h >> 5;
    if (i >= MAX_INSTANCES || !slots[i].base || slots[i].generation != g)
        return 0;
    return &slots[i];
}
static uint32_t allocate(uint32_t size)
{
    uint32_t start = align8((uint32_t)&__heap_base);
    for (;;)
    {
        if (start > MEMORY_BYTES || size > MEMORY_BYTES - start)
            return 0;
        int overlap = 0;
        for (uint32_t i = 0; i < MAX_INSTANCES; i++)
        {
            Slot *s = &slots[i];
            if (s->base && start < s->base + s->size && s->base < start + size)
            {
                start = align8(s->base + s->size);
                overlap = 1;
                break;
            }
        }
        if (!overlap)
            return start;
    }
}
uint32_t ay_abi_version(void)
{
    return 1;
}
uint32_t ay_config_buffer(void)
{
    return (uint32_t)&setup;
}
int32_t ay_create(uint32_t ptr)
{
    if (ptr != (uint32_t)&setup)
        return E_ARGUMENT;
    Config c = setup;
    if (c.size != 40 || c.abi != 1 || c.chipCount < 1 || c.chipCount > 2 || !c.timebaseHz ||
        c.sampleRate < 8000 || c.sampleRate > 192000 || !c.maxFrames || c.maxFrames > 16384 ||
        !c.maxEvents || c.maxEvents > 16384 || c.flags || !tick_ok(c.origin))
        return E_ARGUMENT;
    uint32_t i = 0;
    while (i < MAX_INSTANCES && (slots[i].base || slots[i].generation >= 0x3ffffffu))
        i++;
    if (i == MAX_INSTANCES)
        return E_MEMORY;
    uint32_t size = align8(sizeof(State)) + c.maxEvents * 16 + c.maxFrames * 8 + 64 +
                    align8(state_bytes()),
             base = allocate(size);
    if (!base)
        return E_MEMORY;
    Slot *s = &slots[i];
    s->generation++;
    s->base = base;
    s->size = size;
    s->state = (State *)base;
    zero((void *)base, size);
    s->state->config = c;
    s->state->tick = s->state->origin = (uint64_t)c.origin;
    s->eventPtr = base + align8(sizeof(State));
    s->leftPtr = s->eventPtr + c.maxEvents * 16;
    s->rightPtr = s->leftPtr + c.maxFrames * 4;
    s->controlPtr = align8(s->rightPtr + c.maxFrames * 4);
    s->statePtr = s->controlPtr + 64;
    for (uint32_t j = 0; j < c.chipCount; j++)
    {
        Chip *p = &s->state->chips[j];
        p->clockHz = c.sampleRate * 8;
        p->step = p->clockHz / (c.sampleRate * 64.0);
        for (int k = 0; k < 3; k++)
            p->channels[k].panLeft = p->channels[k].panRight = 1;
        reset_digital(p);
    }
    return (int32_t)((s->generation << 5) | (i + 1));
}
int32_t ay_configure_chip(int32_t h, uint32_t chip, uint32_t model, uint32_t clock)
{
    Slot *s = get(h);
    if (!s)
        return E_HANDLE;
    if (chip >= s->state->config.chipCount || model > 1 || !clock ||
        clock > 64 * s->state->config.sampleRate)
        return E_ARGUMENT;
    if (s->state->advanced)
        return E_PHASE;
    Chip *p = &s->state->chips[chip];
    p->model = model;
    p->clockHz = clock;
    p->step = clock / (s->state->config.sampleRate * 64.0);
    return 0;
}
int32_t ay_set_mix(int32_t h, uint32_t chip, uint32_t ptr)
{
    Slot *s = get(h);
    if (!s)
        return E_HANDLE;
    if (chip >= s->state->config.chipCount || ptr != s->controlPtr)
        return E_ARGUMENT;
    double *w = (double *)ptr;
    for (int i = 0; i < 6; i++)
        if (!finite(w[i]) || w[i] < 0 || w[i] > 1)
            return E_ARGUMENT;
    for (int i = 0; i < 3; i++)
    {
        s->state->chips[chip].channels[i].panLeft = w[i * 2];
        s->state->chips[chip].channels[i].panRight = w[i * 2 + 1];
    }
    return 0;
}
int32_t ay_write_now(int32_t h, uint32_t chip, uint32_t reg, uint32_t value)
{
    Slot *s = get(h);
    if (!s)
        return E_HANDLE;
    if (chip >= s->state->config.chipCount || reg > 13 || value > 255)
        return E_ARGUMENT;
    write_reg(&s->state->chips[chip], reg, value);
    return 0;
}
int32_t ay_reset_chip_now(int32_t h, uint32_t chip)
{
    Slot *s = get(h);
    if (!s)
        return E_HANDLE;
    if (chip >= s->state->config.chipCount)
        return E_ARGUMENT;
    reset_digital(&s->state->chips[chip]);
    return 0;
}
int32_t ay_reset_transport(int32_t h, double origin)
{
    Slot *s = get(h);
    if (!s)
        return E_HANDLE;
    if (!tick_ok(origin))
        return E_TIME;
    State *p = s->state;
    p->tick = p->origin = (uint64_t)origin;
    p->phase = p->frames = p->advanced = 0;
    for (uint32_t i = 0; i < p->config.chipCount; i++)
    {
        Chip *c = &p->chips[i];
        uint32_t model = c->model, clock = c->clockHz;
        double weights[6];
        for (int j = 0; j < 3; j++)
        {
            weights[j * 2] = c->channels[j].panLeft;
            weights[j * 2 + 1] = c->channels[j].panRight;
        }
        zero(c, sizeof(Chip));
        c->model = model;
        c->clockHz = clock;
        c->step = clock / (p->config.sampleRate * 64.0);
        for (int j = 0; j < 3; j++)
        {
            c->channels[j].panLeft = weights[j * 2];
            c->channels[j].panRight = weights[j * 2 + 1];
        }
        reset_digital(c);
    }
    return 0;
}
static uint64_t event_tick(const uint8_t *e)
{
    uint32_t low, high;
    copy(&low, e, 4);
    copy(&high, e + 4, 4);
    return (uint64_t)low | ((uint64_t)high << 32);
}
int32_t ay_render_until(int32_t h, double end, uint32_t ep, uint32_t count, uint32_t lp,
                        uint32_t rp, uint32_t capacity)
{
    Slot *slot = get(h);
    if (!slot)
        return E_HANDLE;
    State *s = slot->state;
    Config *c = &s->config;
    if (ep != slot->eventPtr || lp != slot->leftPtr || rp != slot->rightPtr)
        return E_ARGUMENT;
    if (!tick_ok(end) || (uint64_t)end < s->tick || (uint64_t)end - s->tick > 4294967295ull)
        return E_TIME;
    if (count > c->maxEvents || capacity > c->maxFrames)
        return E_CAPACITY;
    const uint8_t *events = (const uint8_t *)ep;
    uint64_t prior = s->tick;
    for (uint32_t i = 0; i < count; i++)
    {
        const uint8_t *e = events + i * 16;
        uint64_t t = event_tick(e);
        if (t > SAFE_TICK || t < prior || t > (uint64_t)end)
            return E_ORDER;
        prior = t;
        if (e[8] >= c->chipCount || e[9] > 1 || e[12] || e[13] || e[14] || e[15] ||
            (e[9] == 0 ? e[10] > 13 : e[10] != 0 || e[11] != 0))
            return E_ARGUMENT;
    }
    uint64_t q = s->phase + ((uint64_t)end - s->tick) * c->sampleRate, total = q / c->timebaseHz;
    if (total > SAFE_TICK - s->frames)
        return E_TIME;
    if (total > capacity)
        return E_CAPACITY;
    float *left = (float *)lp, *right = (float *)rp;
    uint32_t written = 0;
    for (uint32_t i = 0; i <= count; i++)
    {
        uint64_t target = i < count ? event_tick(events + i * 16) : (uint64_t)end;
        q = s->phase + (target - s->tick) * c->sampleRate;
        uint32_t frames = (uint32_t)(q / c->timebaseHz);
        s->phase = (uint32_t)(q % c->timebaseHz);
        if (target > s->tick)
            s->advanced = 1;
        s->tick = target;
        for (uint32_t j = 0; j < frames; j++)
        {
            double l = 0, r = 0;
            for (uint32_t k = 0; k < c->chipCount; k++)
            {
                process(&s->chips[k]);
                l += s->chips[k].left;
                r += s->chips[k].right;
            }
            left[written] = (float)l;
            right[written++] = (float)r;
        }
        s->frames += frames;
        if (i < count)
        {
            const uint8_t *e = events + i * 16;
            Chip *p = &s->chips[e[8]];
            if (e[9])
                reset_digital(p);
            else
                write_reg(p, e[10], e[11]);
        }
    }
    return (int32_t)written;
}
int32_t ay_get_registers(int32_t h, uint32_t chip, uint32_t ptr)
{
    Slot *s = get(h);
    if (!s)
        return E_HANDLE;
    if (chip >= s->state->config.chipCount || ptr != s->controlPtr)
        return E_ARGUMENT;
    copy((void *)ptr, s->state->chips[chip].regs, 14);
    return 0;
}
int32_t ay_get_position(int32_t h, uint32_t ptr)
{
    Slot *s = get(h);
    if (!s)
        return E_HANDLE;
    if (ptr != s->controlPtr)
        return E_ARGUMENT;
    double tick = (double)s->state->tick, frames = (double)s->state->frames;
    copy((void *)ptr, &tick, 8);
    copy((void *)(ptr + 8), &s->state->phase, 4);
    zero((void *)(ptr + 12), 4);
    copy((void *)(ptr + 16), &frames, 8);
    return 0;
}
static uint32_t checksum(const uint8_t *p, uint32_t n)
{
    uint32_t hash = 2166136261u;
    while (n--)
        hash = (hash ^ *p++) * 16777619u;
    return hash;
}
int32_t ay_state_size(int32_t h)
{
    return get(h) ? (int32_t)state_bytes() : E_HANDLE;
}
int32_t ay_save_state(int32_t h, uint32_t ptr, uint32_t capacity)
{
    Slot *s = get(h);
    if (!s)
        return E_HANDLE;
    if (ptr != s->statePtr)
        return E_ARGUMENT;
    if (capacity < state_bytes())
        return E_CAPACITY;
    uint32_t *header = (uint32_t *)ptr;
    header[0] = 0x54535941;
    header[1] = header[2] = header[4] = 1;
    header[3] = 2;
    header[5] = state_bytes();
    copy((void *)(ptr + 28), s->state, sizeof(State));
    header[6] = checksum((const uint8_t *)(ptr + 28), sizeof(State));
    return state_bytes();
}
static int config_equal(const Config *a, const Config *b)
{
    return a->size == b->size && a->abi == b->abi && a->chipCount == b->chipCount &&
           a->timebaseHz == b->timebaseHz && a->sampleRate == b->sampleRate &&
           a->maxFrames == b->maxFrames && a->maxEvents == b->maxEvents && a->flags == b->flags &&
           a->origin == b->origin;
}
int32_t ay_load_state(int32_t h, uint32_t ptr, uint32_t length)
{
    Slot *s = get(h);
    if (!s)
        return E_HANDLE;
    if (ptr != s->statePtr)
        return E_ARGUMENT;
    if (length != state_bytes())
        return E_STATE;
    const uint32_t *header = (const uint32_t *)ptr;
    if (header[0] != 0x54535941 || header[1] != 1 || header[2] != 1 || header[3] != 2 ||
        header[4] != 1 || header[5] != length ||
        header[6] != checksum((const uint8_t *)(ptr + 28), sizeof(State)))
        return E_STATE;
    /* Snapshot payload is aligned by copying into local validation state. This
     * setup-time operation is outside the render loop. */
    State candidate;
    copy(&candidate, (const void *)(ptr + 28), sizeof(State));
    if (!config_equal(&candidate.config, &s->state->config) || candidate.tick > SAFE_TICK ||
        candidate.origin > candidate.tick || candidate.frames > SAFE_TICK ||
        candidate.phase >= candidate.config.timebaseHz || candidate.advanced > 1)
        return E_STATE;
    uint64_t elapsed = candidate.tick - candidate.origin,
             whole = elapsed / candidate.config.timebaseHz,
             remainder = elapsed % candidate.config.timebaseHz;
    if (whole > SAFE_TICK / candidate.config.sampleRate)
        return E_STATE;
    uint64_t expected = whole * candidate.config.sampleRate +
                        (remainder * candidate.config.sampleRate) / candidate.config.timebaseHz;
    if (expected != candidate.frames ||
        (remainder * candidate.config.sampleRate) % candidate.config.timebaseHz !=
            candidate.phase ||
        candidate.advanced != (candidate.tick > candidate.origin))
        return E_STATE;
    for (uint32_t i = 0; i < candidate.config.chipCount; i++)
    {
        Chip *p = &candidate.chips[i];
        if (p->model > 1 || !p->clockHz || p->clockHz > 64 * candidate.config.sampleRate ||
            p->step != p->clockHz / (candidate.config.sampleRate * 64.0) || !finite(p->x) ||
            p->x < 0 || p->x >= 1 || p->noise > 131071 || p->noisePeriod > 31 ||
            p->noiseCounter > 62 || p->envelopeShape > 15 || p->envelopeSegment > 1 ||
            p->envelope > 31 || !p->envelopePeriod || p->envelopePeriod > 65535 ||
            p->envelopeCounter > 65535 || p->firIndex >= 23 || p->dcIndex >= 1024)
            return E_STATE;
        for (int j = 0; j < 14; j++)
            if ((p->regs[j] & masks[j]) != p->regs[j])
                return E_STATE;
        for (int j = 0; j < 3; j++)
        {
            Channel *c = &p->channels[j];
            if (c->tonePeriod < 1 || c->tonePeriod > 4095 || c->toneCounter > 4095 || c->tone > 1 ||
                c->tOff > 1 || c->nOff > 1 || c->eOn > 1 || c->volume > 15 || !finite(c->panLeft) ||
                !finite(c->panRight) || c->panLeft < 0 || c->panLeft > 1 || c->panRight < 0 ||
                c->panRight > 1)
                return E_STATE;
        }
        if (!finite(p->left) || !finite(p->right) || !finite(p->dcSumLeft) ||
            !finite(p->dcSumRight))
            return E_STATE;
        for (int j = 0; j < 4; j++)
            if (!finite(p->cLeft[j]) || !finite(p->cRight[j]) || !finite(p->yLeft[j]) ||
                !finite(p->yRight[j]))
                return E_STATE;
        for (int j = 0; j < 384; j++)
            if (!finite(p->firLeft[j]) || !finite(p->firRight[j]))
                return E_STATE;
        for (int j = 0; j < 1024; j++)
            if (!finite(p->dcLeft[j]) || !finite(p->dcRight[j]))
                return E_STATE;
    }
    copy(s->state, &candidate, sizeof(State));
    return 0;
}
int32_t ay_destroy(int32_t h)
{
    Slot *s = get(h);
    if (!s)
        return E_HANDLE;
    s->base = s->size = 0;
    s->state = 0;
    return 0;
}
uint32_t ay_event_buffer(int32_t h)
{
    Slot *s = get(h);
    return s ? s->eventPtr : 0;
}
uint32_t ay_left_buffer(int32_t h)
{
    Slot *s = get(h);
    return s ? s->leftPtr : 0;
}
uint32_t ay_right_buffer(int32_t h)
{
    Slot *s = get(h);
    return s ? s->rightPtr : 0;
}
uint32_t ay_control_buffer(int32_t h)
{
    Slot *s = get(h);
    return s ? s->controlPtr : 0;
}
uint32_t ay_state_buffer(int32_t h)
{
    Slot *s = get(h);
    return s ? s->statePtr : 0;
}
