/*
 * Lossless, on-demand track store for LIRON SmartPort media.
 *
 * HD20: 16 logical 512-byte sectors = one 8 KiB surface-map cell.
 * UniDisk 3.5: one physical track/side, with 12/11/10/9/8 sectors
 * in five consecutive 16-cylinder speed zones.
 *
 * Each track is stored as independent raw DEFLATE (pako) or as raw bytes
 * when compression would increase its size. All-zero tracks are implicit.
 * Only ONE decompressed track is cached; dirty writeback occurs on eviction.
 * No whole-disk uncompressed image survives loadImage().
 *
 * getImage() builds a temporary full-size Uint8Array only for export.
 * Synchronous block reads and writes preserve the SmartPort API.
 */
(function(root,factory)
{
    "use strict";
    var type=factory();
    if(typeof(module)==="object" && module.exports) module.exports=type;
    if(root) root.TrackCompressedMedia=type;
})(typeof(globalThis)!=="undefined" ? globalThis : this,function()
{
    "use strict";

    function TrackCompressedMedia(options)
    {
        options=options||{};
        var bytesPerBlock=Number(options.blockSize)||512;
        var blockCount=Number(options.blockCount);
        if(!Number.isInteger(bytesPerBlock) || bytesPerBlock<1 ||
           !Number.isInteger(blockCount) || blockCount<1)
            throw new RangeError("Invalid track media geometry");

        var counts=options.blocksPerTrack;
        if(Number.isInteger(counts))
        {
            if(counts<1 || blockCount%counts!==0)
                throw new RangeError("Block count must align to logical tracks");
            counts=Array(blockCount/counts).fill(counts);
        }
        else if(Array.isArray(counts)) counts=counts.slice();
        else throw new TypeError("blocksPerTrack must be a positive integer or an array");
        if(counts.some(function(n){return !Number.isInteger(n) || n<1;}) ||
           counts.reduce(function(a,b){return a+b;},0)!==blockCount)
            throw new RangeError("Track geometry does not cover the medium");

        var starts=[],first=0;
        for(var t=0;t<counts.length;t++)
        {
            starts.push(first);
            first+=counts[t];
        }

        var codec=options.codec || null;
        var compress=codec && typeof(codec.deflateRaw)==="function"
            && typeof(codec.inflateRaw)==="function" ? codec : null;

        var tracks=Array(counts.length).fill(null); // null is an all-zero track.
        var densities=Array.from({length:counts.length},function()
        {
            return {nonzero:0,sum:0};
        });
        var storedBytes=0;
        var active=-1,activeData=null,dirty=false;
        var totalBytes=bytesPerBlock*blockCount;

        this.length=totalBytes;
        this.blockCount=blockCount;
        this.blockSize=bytesPerBlock;
        this.trackCount=counts.length;

        function trackForBlock(block)
        {
            var low=0,high=starts.length-1;
            while(low<=high)
            {
                var middle=(low+high)>>1;
                if(block<starts[middle]) high=middle-1;
                else if(block>=starts[middle]+counts[middle]) low=middle+1;
                else return middle;
            }
            throw new RangeError("Block outside track geometry");
        }

        function trackLength(index)
        {
            return counts[index]*bytesPerBlock;
        }

        function density(bytes)
        {
            var nonzero=0,sum=0;
            for(var i=0;i<bytes.length;i++)
            {
                var value=bytes[i];
                sum+=value;
                if(value!==0) nonzero++;
            }
            return {nonzero:nonzero,sum:sum};
        }

        function encode(bytes,statistics)
        {
            if(statistics.nonzero===0) return null;
            if(compress)
            {
                var encoded=compress.deflateRaw(bytes,{level:1});
                if(encoded.length<bytes.length)
                    return {bytes:encoded,compressed:true};
            }
            // Ensure the loaded image and callers never own our track storage.
            return {bytes:bytes.slice(),compressed:false};
        }

        function unpack(index)
        {
            var entry=tracks[index],len=trackLength(index);
            if(!entry) return new Uint8Array(len);
            var bytes=entry.compressed
                ? compress.inflateRaw(entry.bytes)
                : entry.bytes;
            if(bytes.length!==len)
                throw new Error("Corrupt compressed SmartPort track "+index);
            return entry.compressed ? bytes : bytes.slice();
        }

        function flush()
        {
            if(active<0 || !dirty) return;
            var prior=tracks[active];
            if(prior) storedBytes-=prior.bytes.byteLength;
            var stats=density(activeData);
            var entry=encode(activeData,stats);
            tracks[active]=entry;
            densities[active]=stats;
            if(entry) storedBytes+=entry.bytes.byteLength;
            dirty=false;
        }

        function access(index)
        {
            if(index!==active)
            {
                flush();
                activeData=unpack(index);
                active=index;
                dirty=false;
            }
            return activeData;
        }

        this.readBlock=function(block)
        {
            block=Number(block);
            if(!Number.isInteger(block) || block<0 || block>=blockCount)
                throw new RangeError("SmartPort block out of range");
            var idx=trackForBlock(block);
            var data=access(idx);
            var offset=(block-starts[idx])*bytesPerBlock;
            return data.slice(offset,offset+bytesPerBlock);
        };

        this.writeBlock=function(block,bytes)
        {
            block=Number(block);
            if(!Number.isInteger(block) || block<0 || block>=blockCount)
                throw new RangeError("SmartPort block out of range");
            if(!bytes || bytes.length!==bytesPerBlock)
                throw new RangeError("SmartPort block size mismatch");
            var idx=trackForBlock(block);
            access(idx).set(bytes,(block-starts[idx])*bytesPerBlock);
            dirty=true;
        };

        this.loadImage=function(data)
        {
            if(!data || data.length!==totalBytes)
                throw new RangeError("SmartPort image size does not match geometry");
            // Build an independent candidate store before changing the live
            // medium. A failed compressor must not destroy existing media.
            var next=Array(counts.length);
            var nextDensity=Array(counts.length);
            var bytesUsed=0;
            for(var index=0;index<counts.length;index++)
            {
                var start=starts[index]*bytesPerBlock;
                var bytes=data.subarray
                    ? data.subarray(start,start+trackLength(index))
                    : Uint8Array.from(Array.prototype.slice.call(data,start,start+trackLength(index)));
                var stats=density(bytes);
                var entry=encode(bytes,stats);
                next[index]=entry;
                nextDensity[index]=stats;
                if(entry) bytesUsed+=entry.bytes.byteLength;
            }
            tracks=next;
            densities=nextDensity;
            storedBytes=bytesUsed;
            active=-1;
            activeData=null;
            dirty=false;
            return totalBytes;
        };

        this.format=function()
        {
            tracks=Array(counts.length).fill(null);
            densities=Array.from({length:counts.length},function(){return {nonzero:0,sum:0};});
            storedBytes=0;
            active=-1;
            activeData=null;
            dirty=false;
        };

        this.getImage=function()
        {
            var out=new Uint8Array(totalBytes);
            for(var index=0;index<counts.length;index++)
            {
                var entry=tracks[index];
                if(!entry && index!==active) continue;
                var data=index===active ? activeData : unpack(index);
                out.set(data,starts[index]*bytesPerBlock);
            }
            return out;
        };

        this.rangeDensity=function(firstBlock,lastBlock)
        {
            firstBlock=Number(firstBlock);lastBlock=Number(lastBlock);
            if(!Number.isInteger(firstBlock) || !Number.isInteger(lastBlock) ||
               firstBlock<0 || lastBlock<firstBlock || lastBlock>=blockCount)
                return {pct:0,nonzero:0,avg:0};
            var total=(lastBlock-firstBlock+1)*bytesPerBlock;
            var nonzero=0,sum=0;
            var firstTrack=trackForBlock(firstBlock),lastTrack=trackForBlock(lastBlock);
            for(var index=firstTrack;index<=lastTrack;index++)
            {
                var low=Math.max(firstBlock,starts[index]);
                var high=Math.min(lastBlock+1,starts[index]+counts[index]);
                if(low===starts[index] && high===starts[index]+counts[index] &&
                   !(index===active && dirty))
                {
                    nonzero+=densities[index].nonzero;
                    sum+=densities[index].sum;
                }
                else
                {
                    var data=access(index);
                    var start=(low-starts[index])*bytesPerBlock;
                    var end=(high-starts[index])*bytesPerBlock;
                    for(var i=start;i<end;i++)
                    {
                        var value=data[i];
                        sum+=value;
                        if(value!==0) nonzero++;
                    }
                }
            }
            return {pct:Math.round(nonzero*100/total),
                    nonzero:nonzero,avg:Math.round(sum/total)};
        };

        this.stats=function()
        {
            flush(); // report the actual post-write compressed footprint.
            return {
                 mode:compress ? "pako-raw-deflate" : "raw"
                ,logicalBytes:totalBytes
                ,storedBytes:storedBytes
                ,cacheBytes:activeData ? activeData.byteLength : 0
                ,trackCount:counts.length
                ,compressedTracks:tracks.filter(function(t){return t && t.compressed;}).length
                ,rawTracks:tracks.filter(function(t){return t && !t.compressed;}).length
                ,zeroTracks:tracks.filter(function(t){return t===null;}).length
            };
        };
    }
    return TrackCompressedMedia;
});
