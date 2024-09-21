LZ data compressor/decompressor for the Apple II by Peter Ferrie.
About 25 years too late, but in all that time, I've seen only RLE-based dempressors, and no compressors.
Both programs accept a file called LZI as input, and produce a file called LZO as output.
Note that both compressed and uncompressed data must fit in memory at the same time, but the the code does not check that it will fit.
It might be interesting to take advantage of extra memory if it is available, or to move the compressor/decompressor to somewhere lower in memory, or even to stream the data directly from disk while decompressing, but the intention was to make the code as simple and clean as possible.

http://pferrie.tripod.com
