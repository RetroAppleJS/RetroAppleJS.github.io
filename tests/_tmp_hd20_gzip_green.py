from pathlib import Path

hd=Path('res/EMU_DEVICE_HD20.js')
s=hd.read_text()
old=r'''    function poFilename(name)
    {
        name=String(name || "").split(/[\\/]/).pop();
        if(!name) return "UNFORMATTED-HD20.po";
        name=name.replace(/\.[^.]*$/,'');
        return (name || "UNFORMATTED-HD20")+".po";
    }'''
new=r'''    function poFilename(name)
    {
        name=String(name || "").split(/[\\/]/).pop();
        if(!name) return "UNFORMATTED-HD20.po";
        name=name.replace(/\.po\.gz$/i,'').replace(/\.[^.]*$/,'');
        return (name || "UNFORMATTED-HD20")+".po";
    }'''
if old not in s:
    raise SystemExit('HD20 poFilename pattern not found')
hd.write_text(s.replace(old,new,1))

card=Path('res/EMU_CARD_LIRON.js')
s=card.read_text()

marker='''    this.deviceToolLoadFile = function(input,unit)
    {'''
helper=r'''    function deviceToolArchiveFilename(filename,hardDisk)
    {
        filename=String(filename || (hardDisk ? "HD20.po" : "UNIDISK.po"));
        if(!hardDisk) return filename;
        filename=filename.replace(/\.gz$/i,"");
        if(!/\.po$/i.test(filename)) filename += ".po";
        return filename+".gz";
    }

'''+marker
if marker not in s:
    raise SystemExit('deviceToolLoadFile marker not found')
s=s.replace(marker,helper,1)

old='''        var expectedBytes=blockSize*blockCount;

        function clearInput()'''
new='''        var expectedBytes=blockSize*blockCount;
        var mediaFilename=String(file.name || "");
        var gzipHD20=deviceCode==="HD20" && /\.po\.gz$/i.test(mediaFilename);

        function clearInput()'''
if old not in s:
    raise SystemExit('expectedBytes insertion pattern not found')
s=s.replace(old,new,1)

old='''        if(!Number.isInteger(expectedBytes) || expectedBytes<=0 || Number(file.size)!==expectedBytes)
        {'''
new='''        if(!Number.isInteger(expectedBytes) || expectedBytes<=0 || (!gzipHD20 && Number(file.size)!==expectedBytes))
        {'''
if old not in s:
    raise SystemExit('pre-read size check pattern not found')
s=s.replace(old,new,1)

old='''                var bytes=new Uint8Array(ev.target.result);
                var mounted=typeof(EMU_mountDiskImage)==="function" &&
                    EMU_mountDiskImage(bytes,slotN,deviceCode,file.name || "",unit);'''
new='''                var bytes=new Uint8Array(ev.target.result);
                if(gzipHD20)
                {
                    if(bytes.length<2 || bytes[0]!==0x1F || bytes[1]!==0x8B)
                    {
                        console.error(mediaLabel+" load failed: invalid gzip image",{"slotN":slotN,"unit":unit,"filename":mediaFilename,"bytes":bytes.length});
                        if(typeof(alert)==="function") alert("Unable to decompress "+mediaLabel+" image: invalid gzip data.");
                        clearInput();
                        return;
                    }
                    if(typeof(pako)==="undefined" || !pako || typeof(pako.ungzip)!==="function")
                    {
                        console.error(mediaLabel+" load failed: gzip support unavailable",{"slotN":slotN,"unit":unit,"filename":mediaFilename});
                        if(typeof(alert)==="function") alert(mediaLabel+" gzip support is unavailable.");
                        clearInput();
                        return;
                    }
                    try
                    {
                        bytes=Uint8Array.from(pako.ungzip(bytes));
                    }
                    catch(gzipError)
                    {
                        console.error(mediaLabel+" load failed: gzip decompression error",{"slotN":slotN,"unit":unit,"filename":mediaFilename,"error":gzipError && gzipError.message ? gzipError.message : String(gzipError)});
                        if(typeof(alert)==="function") alert("Unable to decompress "+mediaLabel+" image.");
                        clearInput();
                        return;
                    }
                    if(bytes.length!==expectedBytes)
                    {
                        console.error(mediaLabel+" load failed: invalid expanded image size",{"slotN":slotN,"unit":unit,"filename":mediaFilename,"expected":expectedBytes,"actual":bytes.length});
                        if(typeof(alert)==="function") alert(mediaLabel+" gzip image must expand to exactly "+expectedBytes+" bytes.");
                        clearInput();
                        return;
                    }
                }

                var mounted=typeof(EMU_mountDiskImage)==="function" &&
                    EMU_mountDiskImage(bytes,slotN,deviceCode,mediaFilename,unit);'''
if old not in s:
    raise SystemExit('loader mount pattern not found')
s=s.replace(old,new,1)

old='''        var image=target.getImage();
        if(!image || typeof(image.length)!=="number" || image.length<=0) return false;
        var filename=String(target.getSuggestedFilename() || "HD20.po");
        oCOM.Download(filename,image);
        return true;'''
new='''        var image=target.getImage();
        if(!image || typeof(image.length)!=="number" || image.length<=0) return false;
        var hardDisk=String(target.id && target.id.DCODE || "")==="HD20";
        var filename=deviceToolArchiveFilename(target.getSuggestedFilename(),hardDisk);
        var payload=image;
        if(hardDisk)
        {
            if(typeof(pako)==="undefined" || !pako || typeof(pako.gzip)!==="function")
            {
                console.error("Apple Hard Disk 20 download failed: gzip support unavailable");
                if(typeof(alert)==="function") alert("Apple Hard Disk 20 gzip support is unavailable.");
                return false;
            }
            try { payload=pako.gzip(image); }
            catch(gzipError)
            {
                console.error("Apple Hard Disk 20 download failed: gzip compression error",gzipError);
                if(typeof(alert)==="function") alert("Unable to compress Apple Hard Disk 20 image.");
                return false;
            }
        }
        oCOM.Download(filename,payload);
        return true;'''
if old not in s:
    raise SystemExit('download implementation pattern not found')
s=s.replace(old,new,1)

old='''        var filename=exportable ? String(device.getSuggestedFilename() || (hardDisk ? "HD20.po" : "UNIDISK.po")) : "";
        var displayFilename=hardDisk'''
new='''        var filename=exportable ? String(device.getSuggestedFilename() || (hardDisk ? "HD20.po" : "UNIDISK.po")) : "";
        var downloadFilename=deviceToolArchiveFilename(filename,hardDisk);
        var displayFilename=hardDisk'''
if old not in s:
    raise SystemExit('sync filename pattern not found')
s=s.replace(old,new,1)

old='''            download.title=downloadable ? ("Save "+filename) : (exportable ? "Save disk (no media loaded)" : "Save disk (not implemented yet)");'''
new='''            download.title=downloadable ? ("Save "+downloadFilename) : (exportable ? "Save disk (no media loaded)" : "Save disk (not implemented yet)");'''
if old not in s:
    raise SystemExit('sync download title pattern not found')
s=s.replace(old,new,1)

old='''            var logicalFilename=exportable ? String(device.getSuggestedFilename() || (hardDisk ? "HD20.po" : "UNIDISK.po")) : undefined;
            var displayFilename=hardDisk'''
new='''            var logicalFilename=exportable ? String(device.getSuggestedFilename() || (hardDisk ? "HD20.po" : "UNIDISK.po")) : undefined;
            var downloadFilename=deviceToolArchiveFilename(logicalFilename,hardDisk);
            var displayFilename=hardDisk'''
if old not in s:
    raise SystemExit('renderer filename pattern not found')
s=s.replace(old,new,1)

old='''                ,"fileAccept":".po"'''
new='''                ,"fileAccept":hardDisk ? ".po,.po.gz" : ".po"'''
if old not in s:
    raise SystemExit('fileAccept pattern not found')
s=s.replace(old,new,1)

old='''                ,"downloadTitle":downloadable ? ("Save "+logicalFilename) : (exportable ? "Save disk (no media loaded)" : "Save disk (not implemented yet)")'''
new='''                ,"downloadTitle":downloadable ? ("Save "+downloadFilename) : (exportable ? "Save disk (no media loaded)" : "Save disk (not implemented yet)")'''
if old not in s:
    raise SystemExit('renderer download title pattern not found')
s=s.replace(old,new,1)

card.write_text(s)
