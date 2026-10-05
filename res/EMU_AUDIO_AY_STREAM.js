// Source/transport policy for real-time AY music. No wall clock enters synthesis.
function AYSourceClock(nominalHz, cpuOrigin, audioOrigin)
{
    var source = this;
    this.nominalHz = nominalHz;
    this.cpuOrigin = cpuOrigin || 0;
    this.anchorQ32 = BigInt(audioOrigin || 0) << 32n;
    this.rateNumerator = 0;
    this.rateDenominator = 1;
    this.segmentChanges = 0;
    this.paused = false;
    function canonical(hz)
    {
        if (!Number.isFinite(hz) || hz < 0.001 || hz > 4294967295)
            throw AYCore.error('E_ARGUMENT', 'Invalid CPU target frequency');
        var numerator = Math.round(hz * 1000), denominator = 1000, a = numerator, b = denominator;
        while (b)
        {
            var remainder = a % b;
            a = b;
            b = remainder;
        }
        return {numerator: numerator / a, denominator: denominator / a};
    }
    function project(cpuTick)
    {
        if (!AYCore.validTick(cpuTick) || cpuTick < source.cpuOrigin) throw AYCore.error('E_TIME');
        var q = source.anchorQ32 +
            (BigInt(cpuTick - source.cpuOrigin) * 1000000000n * BigInt(source.rateDenominator) *
             4294967296n) /
                BigInt(source.rateNumerator);
        if (q >> 32n > 9007199254740991n) throw AYCore.error('E_TIME', 'Audio timeline exhausted');
        return q;
    }
    var initial = canonical(nominalHz);
    this.rateNumerator = initial.numerator;
    this.rateDenominator = initial.denominator;
    if (!AYCore.validTick(this.cpuOrigin) || !AYCore.validTick(audioOrigin || 0))
        throw AYCore.error('E_TIME');
    this.map = function(cpuTick) {
        return Number(project(cpuTick) >> 32n);
    };
    this.setRate = function(cpuTick, targetHz) {
        if (targetHz === 0)
        {
            project(cpuTick);
            this.paused = true;
            return;
        }
        var next = canonical(targetHz), anchor = project(cpuTick);
        if (this.segmentChanges >= 4294967294)
            throw AYCore.error('E_TIME', 'Speed segment limit reached');
        this.cpuOrigin = cpuTick;
        this.anchorQ32 = anchor;
        this.rateNumerator = next.numerator;
        this.rateDenominator = next.denominator;
        this.segmentChanges++;
        this.paused = false;
    };
    this.saveState = function(cpuTick) {
        return {
            version: 1,
            nominalHz: this.nominalHz,
            cpuOrigin: cpuTick === undefined ? this.cpuOrigin : cpuTick,
            anchorQ32: (cpuTick === undefined ? this.anchorQ32 : project(cpuTick)).toString(),
            rateNumerator: this.rateNumerator,
            rateDenominator: this.rateDenominator,
            segmentChanges: this.segmentChanges,
            paused: this.paused
        };
    };
    this.loadState = function(s) {
        try
        {
            if (!s || s.version !== 1 || s.nominalHz !== this.nominalHz ||
                !AYCore.validTick(s.cpuOrigin) || !Number.isSafeInteger(s.rateNumerator) ||
                s.rateNumerator <= 0 || !AYCore.integer(s.rateDenominator, 1, 1000) ||
                !AYCore.integer(s.segmentChanges, 0, 4294967294) || typeof s.paused !== 'boolean' ||
                !/^\d+$/.test(s.anchorQ32))
                throw 0;
            var anchor = BigInt(s.anchorQ32), hz = s.rateNumerator / s.rateDenominator,
                pair = canonical(hz);
            if (anchor < 0n || anchor >> 32n > 9007199254740991n ||
                pair.numerator !== s.rateNumerator || pair.denominator !== s.rateDenominator)
                throw 0;
            this.cpuOrigin = s.cpuOrigin;
            this.anchorQ32 = anchor;
            this.rateNumerator = s.rateNumerator;
            this.rateDenominator = s.rateDenominator;
            this.segmentChanges = s.segmentChanges;
            this.paused = s.paused;
        }
        catch (error)
        {
            throw AYCore.error('E_STATE');
        }
    };
}

function AYStream(core, options)
{
    options = options || {};
    var capacity = options.maxEvents || core.config.maxEvents;
    if (!AYCore.integer(capacity, 1, core.config.maxEvents)) throw AYCore.error('E_ARGUMENT');
    var data = new Uint8Array(capacity * 16), renderData = new Uint8Array(capacity * 16),
        renderBatch = {data: renderData, count: 0};
    var position = {};
    core.getPosition(position);
    var count = 0, lastTick = position.tick, sealed = position.tick, epoch = options.epoch || 0,
        sequence = 0, firstFrame = position.renderedFrames;
    var stats = {
        pendingEvents: 0,
        eventHighWater: 0,
        stalePackets: 0,
        lateEvents: 0,
        epoch: epoch,
        sequence: 0,
        sealedBeforeTick: sealed,
        firstFrame: firstFrame
    };
    if (!AYCore.validTick(epoch)) throw AYCore.error('E_ARGUMENT');
    this.accept = function(packet) {
        if (!packet || !AYCore.validTick(packet.epoch) || !AYCore.validTick(packet.sequence))
            throw AYCore.error('E_ARGUMENT');
        if (packet.epoch < epoch)
        {
            stats.stalePackets++;
            return false;
        }
        if (packet.epoch !== epoch || packet.sequence !== sequence)
            throw AYCore.error('E_ORDER', 'Stream epoch/sequence mismatch');
        if (!AYCore.validTick(packet.sealedBeforeTick) || packet.sealedBeforeTick < sealed)
            throw AYCore.error('E_TIME');
        var batch = packet.events ||
            (packet.data ? {data: packet.data, count: packet.eventCount} : null),
            n = batch ? batch.count : 0;
        if (!AYCore.integer(n, 0, capacity) || count + n > capacity)
            throw AYCore.error('E_CAPACITY');
        if (n && (!(batch.data instanceof Uint8Array) || batch.data.length < n * 16))
            throw AYCore.error('E_ARGUMENT');
        var prior = lastTick;
        for (var i = 0; i < n; i++)
        {
            var p = i * 16, t = AYCore.eventTick(batch.data, p);
            if (!AYCore.validTick(t) || t < sealed || t < prior || t > packet.sealedBeforeTick)
            {
                stats.lateEvents++;
                throw AYCore.error('E_ORDER');
            }
            if (batch.data[p + 8] >= core.config.chipCount || batch.data[p + 9] > 1 ||
                batch.data[p + 12] || batch.data[p + 13] || batch.data[p + 14] ||
                batch.data[p + 15] ||
                (batch.data[p + 9] === 0 ? batch.data[p + 10] > 13 :
                                           batch.data[p + 10] || batch.data[p + 11]))
                throw AYCore.error('E_ARGUMENT');
            prior = t;
        }
        if (n)
            for (var i = 0; i < n * 16; i++) data[count * 16 + i] = batch.data[i];
        count += n;
        lastTick = prior;
        sealed = packet.sealedBeforeTick;
        sequence++;
        stats.pendingEvents = count;
        stats.eventHighWater = Math.max(stats.eventHighWater, count);
        stats.sequence = sequence;
        stats.sealedBeforeTick = sealed;
        return true;
    };
    this.renderUntil = function(end, output) {
        if (end > sealed) throw AYCore.error('E_TIME', 'CPU interval has not been sealed');
        var consumed = 0;
        while (consumed < count && AYCore.eventTick(data, consumed * 16) <= end) consumed++;
        for (var i = 0; i < consumed * 16; i++) renderData[i] = data[i];
        renderBatch.count = consumed;
        var frames = core.renderUntil(end, renderBatch, output);
        data.copyWithin(0, consumed * 16, count * 16);
        count -= consumed;
        firstFrame += frames;
        stats.pendingEvents = count;
        stats.firstFrame = firstFrame;
        return frames;
    };
    this.beginEpoch = function(next) {
        if (!AYCore.validTick(next) || next <= epoch || count) throw AYCore.error('E_ORDER');
        core.getPosition(position);
        epoch = next;
        sequence = 0;
        sealed = lastTick = position.tick;
        firstFrame = position.renderedFrames;
        stats.epoch = epoch;
        stats.sequence = 0;
        stats.sealedBeforeTick = sealed;
        stats.firstFrame = firstFrame;
    };
    this.getStats = function() {
        return {...stats};
    };
}
