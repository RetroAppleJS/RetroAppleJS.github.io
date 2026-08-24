//
// Copyright (c) 2026 Freddy Vandriessche.
// All rights reserved.
//
// EMU_DEVICE_serialpro_line.js
//
// External byte-stream line owned by the Applied Engineering Serial Pro card.
// The card/firmware/6551 remain the SPC peripheral; this device models the
// external serial connection presented by the UART.
//

function SerialProLine()
{
    var line = this;
    var host = null;
    var listeners = [];

    this.id = {
         "DCODE":"SPSERIAL"
        ,"hostPCODE":"SPC"
        ,"icon":"fa fa-exchange-alt"
        ,"description":"Serial Pro external serial line"
    };

    this.ports = {
        "serial":{
             "direction":"duplex"
            ,"mime":["application/octet-stream"]
            ,"handler":"receive"
            ,"description":"Serial Pro external 8-bit serial byte stream"
        }
    };

    function normalizeBytes(data)
    {
        if(data instanceof Uint8Array)
            return data;

        if(data instanceof ArrayBuffer)
            return new Uint8Array(data);

        if(ArrayBuffer.isView(data))
            return new Uint8Array(
                data.buffer,
                data.byteOffset,
                data.byteLength
            );

        if(Array.isArray(data))
        {
            var bytes = new Uint8Array(data.length);
            for(var i=0;i<data.length;i++)
                bytes[i] = Number(data[i]) & 0xFF;
            return bytes;
        }

        if(Number.isInteger(Number(data)))
            return new Uint8Array([Number(data) & 0xFF]);

        return null;
    }

    this.bindHost = function(card)
    {
        host = card || null;

        if(host && typeof(host.bindSerialLineDevice)=="function")
            host.bindSerialLineDevice(line);

        return !!host;
    };

    /*
     * Bytes entering the public duplex port are remote -> Serial Pro traffic.
     * The owning SPC card is responsible for applying 6551 receive timing,
     * word length, RDRF and IRQ behavior.
     */
    this.receive = function(message,context)
    {
        var bytes = normalizeBytes(
            message && message.data!==undefined
                ? message.data
                : message
        );

        if(!bytes || !host ||
           typeof(host.serialLineReceiveBytes)!="function")
            return false;

        return host.serialLineReceiveBytes(
            bytes,
            {
                 "source":"pipe"
                ,"context":context || null
            }
        )==bytes.length;
    };

    this.receiveBytes = function(data,meta)
    {
        var bytes = normalizeBytes(data);

        if(!bytes || !host ||
           typeof(host.serialLineReceiveBytes)!="function")
            return 0;

        return host.serialLineReceiveBytes(bytes,meta || {});
    };

    /*
     * ACIA -> external-line traffic is streaming/event-driven. Until the
     * generic pipe layer grows persistent pipeConnect()/pipeDisconnect(),
     * subscribers are the adapter boundary used by oTERM and Web Serial.
     */
    this.subscribe = function(callback)
    {
        if(typeof(callback)!="function")
            return function(){};

        if(listeners.indexOf(callback)<0)
            listeners.push(callback);

        var subscribed = true;

        return function()
        {
            if(!subscribed) return;
            subscribed = false;

            var index = listeners.indexOf(callback);
            if(index>=0) listeners.splice(index,1);
        };
    };

    this.transmitBytes = function(data,meta)
    {
        var bytes = normalizeBytes(data);
        if(!bytes) return false;

        var snapshot = listeners.slice();

        for(var i=0;i<snapshot.length;i++)
        {
            try
            {
                snapshot[i](bytes,meta || {});
            }
            catch(error)
            {
                console.error("SPSERIAL serial subscriber failed",error);
            }
        }

        return bytes.length;
    };

    this.reset = function()
    {
        // The external cable/line remains present across Apple II RESET.
        return true;
    };
}