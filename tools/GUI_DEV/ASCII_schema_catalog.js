// Hardcoded catalog (extend freely)
  const CATALOG = [
    {
      name: 'ATTiny85',
      type: 'MCU',
      description: '',
      MFR: 'ATTINY85V-10PU',
      pin_data: null,
      text_data:
        '┌───┴─────┴─────┴─────┴───┐\n' +
        '│        @4    @3         │\n' +
        '│╔═ATTiny85══════════════╗│\n' +
        '│║ GND   PB4   PB3   PB5 ║│\n' +
        '│║             TX     ⬤ ║│\n' +
        '│║ SDA                   ║│\n' +
        '│║ MISO  MOSI  SCL       ║│\n' +
        '│║ PB0   PB1   PB2   VCC ║│\n' +
        '│╚═══════════════════════╝│\n' +
        '│  @0    @1    @2         │\n' +
        '└───┬─────┬─────┬─────┬───┘\n',
      image_data:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABAAgMAAADXB5lNAAAAAXNSR0IB2cksfwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAxQTFRFAAAA9fX1ZmVmPj0+fAufOQAAAAR0Uk5TAP/7Xe+ZR0gAAAGFSURBVHicldI9SgNBFADgga1sklOk8AAWm0JP8R7upE4gq+AVvIHVDGFjO8Gsi9gaLALpLJJTRDBVwCrBwvdmdnd21kJ9kMB88/4WRogyuksRRv85PEfmKoRzwDDlA+AmSFAAct+AA1AU/txVDAM/OQYbddvIOKgnd9wZsKrZllBN7qgKyskHqOPVz3RNisZMW3LdmMlhLoOWIGHA4DPmFk7GkDtDZVeLMYPEwpiKGGCUz1xLgBHBGeSQupaAM4IepcoyIZUWJGCZMGfY0V3iWqYJw9aATO1MyC30UkCj7Eyd8GI9uhuObQIm/C08hdrxrwJJt0OeiXOGU7uBoaUkHsrPlwypzvDIEG35qKhlhuuJfSpUDkpKzHFlIaZ6pXKJiwpeaO9MS3wbRA7uqG1OsK7glp6PJtjcV7BTBNSyhndDsGjCkYBaetgYrddTD7tlnOnVxMOF6D4FQH+fOgohmnro/4BlC9xTdVC0oPH6/whFC8RXG8R/4aEFYt8G8Qs8tqBe6huGHP6l63xHWgAAAABJRU5ErkJggg=='
  
    }
    ,
    {
        name: 'ATTinyx24',
        type: 'MCU',
        description: '',
        MFR: 'ATTINY3224-SSU',
        pin_data: null,
        text_data:
'┌───┴─────┴─────┴─────┴─────┴─────┴─────┴───┐\n' +
'│  @5    @4    @3    @2    @1    @0         │\n' +
'│╔═ATTinyx24═══════════════════════════════╗│\n' +
'│║ PB2   PB3   PA7   PA6   PA5   PA4   VCC ║│\n' +
'│║ TX    RX                             ⬤ ║│\n' +
'│║                                         ║│\n' +
'│║ SDA   SCL   UPDI  MOSI  MISO  SCK       ║│\n' +
'│║ PB1   PB0    PA0  PA1   PA2   PA3   GND ║│\n' +
'│╚═════════════════════════════════════════╝│\n' +
'│  @6    @7     @11  @8    @9    @10        │\n' +
'└───┬─────┬──────┬────┬─────┬─────┬─────┬───┘',

      image_data:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABABAMAAABYR2ztAAAAAXNSR0IB2cksfwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAC1QTFRFAAAAJiYmFxcXNzc4bW1urKytTE1N297fxcfIjo6Ptbe4ycnKtLa3iYmK5ufoGiz2AAAAAA90Uk5TAP///vj4/Qoo/WH8n7rxUfwZowAAAwhJREFUeJy9lc9r02AYx99bwpiHJ6mBHXZo9hd0tUGcO8RtascuwjIJK4MuU3B66EFsqR30MOl+9TC6zGWtMhDp5k7CIpTKGHiYslOZbEOcN0Ud9G/wSdLWvMuamz6H5PB8eZ7P+32eNyHkP0Yymcz55Zmjr8rvhI+gM9T3S8/6CD6AYK775DviANJdH8EsYEwnU+2asLIl4L+p9TacdgGAtpxMzRHwldLFBfIhRwDSMWEuaMIe2lkhehP6cwsfvYoZp8DDs7rMf1GqGx6CVyCKCKAXJn5YnB5BOs6JYhBbyBNmnFdKnhazgAIR+CGtEA2BcEIILWFrEOZEDrrq2vIgoiDnT0qRB5ia7NFAqE8tr0II+BGV4mRrIgi9Ah7kZV0uRO4ARL5TnJc4BOSCHEBgV9bGB2TgjXV3iycWICfaPoYCevEtHpjifAz2GRvD6Cs2OP+u30x00qUAQy3gc0Td3WsKDkYnrSbNiOo68l4+izY5map5JLqbjAqr+NJbc2ejsVTNXSJiFHG9+DW8KbbgqXqM03SXGDJX8BXILTjrp5h7DmerBBimwzlhc87j8M5x3hsYRc6uM90WsGXCjpufOVcTQVHG8DXUmnuHEZujOK+MPcB7xA8nGpxL6hqZ4d2cRmTA4iy/qWctwWuzTDIUZ0BXLcWjisOZL2XJwQ5leEhV4xan4XBuEuYcJ1803lGcrPE+dUhx2m7xt5qGL6rPSf6+u4mwjI/w1aZgy9wgS4M33H5aBeKtCvlSgtneofzEkAKt3WQ2PX5iAW3avZss+klxgiSVXXmSqayRTNhdQrvmzpOt6j766eIUwvuUIIOmUJzhfvqKMjnLz9PWfgrhY3I+2JVYssUpdWc9ggz62dng5OO3PXnyDPcz0/BTCngLkDTOfXEnbn9NtGlvnjBzeNHM015sIkkbFwgsjRHLIWdQu97mm5xWh0laE3tC3jM6MY9+pgflnu52P5+0kkBOOdiuACHIuV19MZVtK0DOT7HcnE+epCrrfn8/9LN64psnC4ofwD+IPwq/D/44ndVIAAAAAElFTkSuQmCC'
    }
    ,
    {
        name: 'XIAO_ESP32-C3',
        type: 'MCU',
        description: '',
        MFR: 'Z4T-XIAOESP32C3',
        pin_data: null,
        text_data:
' ╭─────────┬───────┬───────────╮\n' +
' │         ╰──USB──╯           │\n' +
'─┤D0 A0  ╔═SeedStudio═╗      5V├─\n' +
' │       ║            ║        │\n' +
'─┤D1 A1  ║            ║     GND├─\n' +
' │       ║    XIAO    ║        │\n' +
'─┤D2 A2  ║            ║     3V3├─\n' +
' │       ║  ESP32-C3  ║        │\n' +
'─┤D3     ║            ║MOSI D10├─\n' +
' │       ║            ║        │\n' +
'─┤D4 SDA ║            ║MISO  D9├─\n' +
' │       ║            ║        │\n' +
'─┤D5 SCL ║            ║ SCK  D8├─\n' +
' │       ║            ║        │\n' +
'─┤D6 TX  ║            ║  RX  D7├─\n' +
' │       ╚════════════╝        │\n' +
' │                             │\n' +
' ╰─────────────────────────────╯',

      image_data:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABABAMAAABYR2ztAAAAAXNSR0IB2cksfwAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAB5QTFRFAAAAHyEl4uHmtK+yfHZ3WlRTNjU4oYVkbmNaoI18rvRBjQAAAAp0Uk5TAP///f7+/fGIPaqpVkYAAAMySURBVHichZbBctowEIZzDEfNYKXXrswDVLLpGSy7Z8Byzwq2Mr01kzSGW3IJyS2nJLxtV3ZsSybTLpix8Yf2/3cXwdlZH+/Pxy6eXs4+iVfTh/4c0KQNbcjnAOmC/g8gJ8D7E8ajA9jrZ+e+zZ67wOMmJqYnJg/2PTUGyJcOOG/k+ys0Wjsl5+QEyIpyQch9Bxi7RJk5wELqFTUdMKlvkZh6QJFndd2lmOzeFmOA0Kv9AOwn1y0QZB+58ANXL2+9zfrwsUKQIlC1wMWwwnn9h7RAie7Jdt4A9Gft22w0VIqootFgY7Bpr5r81NjnGGhtorZKY6dJQIsmxY+RTZPRapVEVKZUNSJ3I5sqM6YqjCnx+LDZA/VhhSk05tG0HSm8no5tBsS0dwmS+sQmVYZ0Q9uf3DtAwoXqh94YIWIXQOEcMBgIG815hCmGOhyKBEYR+zbveoDjAyLOZ67N3RsCSbSUYSLXmySRqYxir5u3OgGZyzyWyTpOpAVmqOG3M5MJRFIk4VIupcCFRDJD657NscjQtVmnPcC4NcoED8mQorVpb4RYhKYUjIfTsU1bIYYH51gwTOHa3L/fnWqY7g+DzdqMAAahb5NamzxWlsu2EBsU6dlEYC6jMio4hCUH1OzZTAu7AmRCiiVkHGaXtg4qH7pZFxbYZukaoAT4iv0Kg3po9/6ILmK23lp9UwSqNYQXR6eb1uY3s77sgASlXAw22xQxu9zAEkABzDBTiF+cXqQxKDKG7dwgMF8CK63IYYdpbcYwT0S8BmY2MK+4Z1MVDcAqWdlx3QBIBCrl2Fw1pWaSD70Iaq+b+bhZzBva4510b2LDGbs6ujZXOTSzwkUkcCBxYpiTAkWSFli282RfGX5d/zm0zO8mWZ4CyrNZSidShTGtR1tQG8GqO3Nd7I7XQY6f1GTz3e42mhqtfZuFyKXKM4r6b/RWykhKz6YhQmlaZYEQIBbbWJkqx+vBZqAj3HiKLGC1EIvNvDBVSamzR5WLqDJGpQG7GYC0//WcPJSZqHDZLIAuhcmp6n/1zl4DXWL9xQr3MiF0kOZYClL86oHJk1K2QEohFhmDeUSs2v8IfwEGVmNubcXoKQAAAABJRU5ErkJggg=='
    }
    ,
        {
        name: 'Arduino Nano',
        type: 'MCU',
        description: 'Arduino Nano with ATmega328P microcontroller.',
        MFR: 'Arduino Nano',
        pin_data: null,
        text_data:
' ┌───────────┬───────┬───────────┐\n' +
' │           ╰──USB──╯           │\n' +
'─┤D13 SCK  Arduino Nano  MISO D12├─\n' +
'─┤3V3         16MHz      MOSI D11├─\n' +
'─┤AREF                     SS D10├─\n' +
'─┤A0/D14                       D9├─\n' +
'─┤A1/D15                       D8├─\n' +
'─┤A2/D16                       D7├─\n' +
'─┤A3/D17                       D6├─\n' +
'─┤A4/D18 SDA                   D5├─\n' +
'─┤A5/D19 SCL                   D4├─\n' +
'─┤A6                      INT1 D3├─\n' +
'─┤A7                      INT0 D2├─\n' +
'─┤5V                          GND├─\n' +
'─┤RESET                     RESET├─\n' +
'─┤GND                      RXD D0├─\n' +
'─┤VIN                      TXD D1├─\n' +
' │                               │\n' +
' └───────────────────────────────┘',
      image_data:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABABAMAAABYR2ztAAAAAXNSR0IB2cksfwAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAB5QTFRFAAAAEXSQeJunysvOPUBBS32NPICVHXmUd4mNzNbcCOcmxgAAAAp0Uk5TAP/++vuh9TM8KPPBRGkAAAHFSURBVHicnZRBTwIxEIU5ep1dnfu2pIlHW7LRI1C5a4DIsQs0HP0JEqNnE07+W6dlUQ8zJdoLm/TjvXmdaQeDP63PvArAwdG6K/z9MJna4TV9fHDANlR6Mm2H2uDymQNW+9ploL26eOGA3cMJwDdWIQBqPR1Z2wCwwLaDtfPeWej4GnZLAqxKgGCBsLbOaQuRtwgR9cg5ZYkULGpyUNq1kbfYdjXtE9EKRQasVKVU0xk5Zr+kmI/fgBizX1JM+Fn/s8hF4ixZCDHT/sYH0SIpoPezUkwS8CQhxcwCWYK3iACXCRgXYmaFKFlEkthkhxjkmElAjJm2NrMgHtQun2Q+6vdys7pQ7iYqATh1s2oKMSFGmhssxFSq3M21o5snxiQLnYFCzCMgdxPSxaEfvsizQxtjF6oGDSoxpr6pbyqLTuzmCRC7qZsjIF1/aiNSDWBi5ItEpEZBA0Y79ilOMZE0wKhXFoh5mpKFoNC/D/TgCjX8PEGloS29UXmijlPJn6Rz/diawPfiVp2Alu/mt0IUFKiGs9f/cjgbTsbR8BYJSNd/bATglwV/kk97skgKULkXDljt+xoIYBUWi8Xcz72/pw8W4NcX3Eyu7NIFgekAAAAASUVORK5CYII='
    }
    ,
    {
        name: 'Daisy Seed',
        type: 'MCU',
        description: 'Daisy Seed is a development board based on the ARM Cortex-M7 microcontroller.',
        MFR: 'Daisy Seed',
        pin_data: null,
        text_data:
' ┌────────────────────Daisy Seed─────────────────┐\n' +
' │                                               │\n' +
'─┤3V3_Analog         ARM Cortex-M7           AGND├─\n' +
'─┤ADC0   A0/D15         480MHz          AudioOut2├─\n' +
'─┤ADC1   A1/D16                         AudioOut1├─\n' +
'─┤ADC2   A2/D17                          AudioIn2├─\n' +
'─┤ADC3   A3/D18                          AudioIn1├─\n' +
'─┤ADC4   A4/D19            D14 USART1_Rx/I2C4_SDA├─\n' +
'─┤ADC5   A5/D20            D13 USART1_Tx/I2C4_SCL├─\n' +
'─┤ADC6   A6/D21            D12 I2C1_SDA /UART4_Tx├─\n' +
'─┤ADC7   A7/D22 DAC_OUT2   D11 I2C1_SCL /UART4_Rx├─\n' +
'─┤ADC8   A8/D23 DAC_OUT1   D10 SPI1_MOSI/UART2_Tx├─\n' +
'─┤ADC9   A9/D24 SAI_MCLK   D9 SPI1_MISO          ├─\n' +
'─┤ADC10 A10/D25 SAI2_SDB   D8 SPI1_SCK  /SPDIFRX1├─\n' +
'─┤          D26 SAI2_SDA   D7 SPI1_CS            ├─\n' +
'─┤          D27 SAI2_FS    D6 SD_CLK.  /USART5_Tx├─\n' +
'─┤ADC11 A11/D28 SAI2_SCK   D5 SD_CMD.  /USART5_Rx├─\n' +
'─┤USART1_Tx D29 USB_D-     D4 SD_Data0           ├─\n' +
'─┤USART1_Rx D30 USB_D+     D3 SD_Data1           ├─\n' +
'─┤3V3_Digital              D2 SD_Data2 /USART3_Tx├─\n' +
'─┤VIN                      D1 SD_Data3 /USART3_Rx├─\n' +
'─┤DGND                    D0 USB ID              ├─\n' +
' │                    ╭──USB──╮                  │\n' +
' └────────────────────┴───────┴──────────────────┘',
      image_data:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABABAMAAABYR2ztAAAAAXNSR0IB2cksfwAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAB5QTFRFAAAA2qg/MTMz2LV01KtJ19XPoINMYFdCxad+1rUs7IThTgAAAAp0Uk5TAPr//7P+/f5ZWoTOXAoAAAFnSURBVHicvZSxSsRAEIbzCsN4eYAUpl6HxNbACteGsNeH02AdjmxrQMVSwca3dTabHAj3GxH1b/MxX2Z2Z5PkmHer2Vr7YO1LciqvlRG6zLJzOrs6DYwidJFludkCgCgCRACoiGIFqOAIEFTImoJlTbHWxQL8XCFiAiBfKUrvBzYIEDZErcB/GGmK4EGxTIGDom4OAp6ymBwqFgAq1oBVRfWPCnSaq4pxmSRUMHM4CbhZdAxScBnPCirS+JNYsQBQMQPw0v6CopwBqCi/qcB7sQB/2AX5KbiLuJlEFinY6H0weDd1u8V7/Y4UY1NQn28agQrn0qzfuwYqXNP1nt3uDgK7rs8VuIEKraCKskUV0i4ougFVGKnTNpng4sxLgZ9BHbW+ccwGzSFMkpi4xopwDjVevUrEiTRSw9e+KZzGYIVsAtDiLswEDPDCjKZQx+2A7sObtdd7BQ4WVNA8BsU9+qp5DvkMfAAoh7C+1ipazQAAAABJRU5ErkJggg=='
    }
    ,
    {
      name: 'OLED SSD1309',
      type: 'Display',
      description: '',
      MFR: 'SSD1309',
      pin_data: null,
              text_data:
        '┌───┴─────┴─────┴─────┴───┐\n' +
        '│  GND   VCC   SCL   SDA  │\n' +
        '│╔═SSD1309═══════════════╗│\n' +
        '│║                       ║│\n' +
        '│║                       ║│\n' +
        '│║      64 x 32 OLED     ║│\n' +                       
        '│║                       ║│\n' +  
        '│║                       ║│\n' +  
        '│╚═══════════════════════╝│\n' +  
        '│                         │\n' +  
        '└─────────────────────────┘\n',
        image_data:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABABAMAAABYR2ztAAAAAXNSR0IB2cksfwAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAB5QTFRFAAAAAgMNESlTWmNv3eLlvsLHOERYZ3iMNEhm19jYkDYxiQAAAAp0Uk5TAP/+/x/6/DmTiZs+NYQAAAHnSURBVHicjdU9b9swEAZgDgSUlTLg3cdW9UxCBLoJiD1otUDPldQma5oWQbIlaAChc50C/bflUUpj8UvlJEAP717cQTYh/3nuh5s0uIWhWgAwLIG0QADP43Ow1y3vsEZWEVqHASCAp4HUO7ILgEsYD/u5I/XJJ5k+voqhPlX05IKLL1ZgG3ZN6J+KOkEu8lIfoDzYGs+nirhJM2aE0AeOIh9o7YbIGFuX+si1sDUe/JDMirIBeTYxB7C11qLUCLbeai1gK61L8R6Tbr+7YGMF1/pqnIhbYwJGNM04MKcGnQDr9QRgOwctc8UckH/ADAwFjwIUJiYXUTAJFzy9ATt0L8M5QCHgQwLYoSeBGdgxDVivFsDKBV898G4O7pbAN7UEZLsE5mKlPntAbc6B+DQH99KIGXicg+yHVOeCu8D0EGspkkC2/C2oB+jvvlBmA5sYqKX59FneqxjYG2Bur1+D9l6LRiEwogsD00OBrT0G9YFpcjXelRsLvA+c/hrv5jZGAJgYo7BBQwBjYIUWFxsEdI8iN2uTbRBMMQoUsqsCYIwBPa4egsDGKLo+DuiLFFwVcYDCvCykKsLvbQwF0CuIAVI3En9g4gCnATzewsboIAUwRgcpYGKojlcpsZfyYxLQF+39rcXOX9eIntwzgoWWAAAAAElFTkSuQmCC'
     }
     ,    {
      name: 'TFT COM-28380',
      type: 'Display',
      description: 'TFT Touch Screen 320*240 with ILI9341 and XPT2046',
      MFR: 'COM-28380',
      pin_data: null,
      text_data:
        ' ┌────────────────────────────────────────────────┐\n' +
        ' │  ╔═COM-28380 Touch Screen 320*240═══════════╗  │\n' +
        ' │  ║                                   ┌T_IRQ ║  ├─\n' +
        ' │  ║                                   │T_DO  ║  ├─\n' +
        ' │  ║                           XPT20466│T_DIN ║  ├─\n' +
        ' │  ║                                   │T_CS  ║  ├─\n' +
        ' │  ║                                   └T_CLK ║  ├─\n' +
        ' │  ║                                   ┌MISO  ║  ├─\n' +
        '─┤  ║                                   │LED   ║  ├─3V3\n' +
        '─┤  ║ SD_SCK                            │SCK   ║  ├─\n' +
        '─┤  ║ SD_MISO                           │MOSI  ║  ├─\n' +
        '─┤  ║ SD_MOSI                   ILI9341 │DC    ║  ├─\n' +
        '─┤  ║ SD_CS                             │RST   ║  ├─\n' +
        ' │  ║                                   │CS    ║  ├─\n' +
        ' │  ║                                   │GND   ║  ├─GND\n' +
        ' │  ║                                   └VCC   ║  ├─5V\n' +
        ' │  ╚══════════════════════════════════════════╝  │\n' +
        ' └────────────────────────────────────────────────┘\n',
          image_data:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABABAMAAABYR2ztAAAAAXNSR0IB2cksfwAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAB5QTFRFAAAAFCc2rhIPjT84hnx4zMrIpV9ZRlJVt5iWfEtK1b+H0wAAAAp0Uk5TAP/8+/r/k/4RPOYmyfEAAAFVSURBVHic7dQxT4NAFAfwF4emjKQmN/sYGjflFRrHlmuJM+1erSG6SSQSt8bBMDYORr6t964Uq95RByfT/0Tu/R4Q7h4AhxyyL2VVVVdrY+EtTaWUhcro/nNd+UoXYlVw62RPaYqnut7lhqbQgB5RDZzse3EDgoQuuZwuLQCRQgY0NAJXAY9BJ4iNQDQAT1rACuAZ+8YnCLcGr22gt7aDYwb0G7BEYQe9hQK+GQjXV3dYQPfG/7ENGyAZ3IEz8DMLIH0Hh1oA0hk4kz2gIz0zcDW4gE5kA/lIgyPs20CGeB62gGKsT4ztSysQIQ6nLSCOPL//CNcmIPiYx3L04BHgzl7p41/wdPBr5TJIcAweCfa5HppM8JWUkzknGUhEoKjQnXm9Op/PpKQmIQSzTUH1yWi7mqqocSzL7gqIBhHtJLwtV18Gesq6fNEdVfVe/vWf5JD/lQ+QJpbNzPkPXwAAAABJRU5ErkJggg=='
     } 
     ,
     {
      name: 'ST7789V2',
      type: 'Display',
      description: '2.4 inch TFT Display 240x280 with ST7789V2 Driver',
      MFR: 'ST7789V2',
      pin_data: null,
      text_data:
        '┌─┴─┴─┴─┴─┴─┴─┴─┴─┴─┐\n' +
        '│GND SCL RES CS  RES│\n' +
        '│  VCC SDA DC  BLK  │\n' +
        '│                   │\n' +
        '│  ╭──ST7789V2───╮  │\n' +
        '│  │             │  │\n' +
        '│  │             │  │\n' +
        '│  │             │  │\n' +
        '│  │             │  │\n' +
        '│  │             │  │\n' +
        '│  │ TFT display │  │\n' +
        '│  │  240 x 280  │  │\n' +
        '│  │             │  │\n' +
        '│  │             │  │\n' +
        '│  │             │  │\n' +
        '│  │             │  │\n' +
        '│  │             │  │\n' +
        '│  ╰─────────────╯  │\n' +
        '└───────────────────┘',
      image_data:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABABAMAAABYR2ztAAAAAXNSR0IB2cksfwAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAB5QTFRFAAAAJyMj/v7+ZYSlo7TLD264GoHJwL/DS57TTklLW9vMyQAAAAp0Uk5TAP4Q+/f5hSc8P1j1BksAAAGySURBVHic3dSxb4JAFAbwS5uIjC/awa1jV3N3adcGWrvrGeYmwHqJiehGmoqMEif+2x7I4cHd4dCl6Vvvl4/PBx56RINzh/4nyKJ8GER5lA6BUZAcggHghixizwOgAIBlYgfVOUB5sgEXLjMrLaAAOaURuACa6IACdKECNaAVCnCLLoATGkepCnrnMDsd2PqrBU4/QAgW74IW6OcAD3HSAu0B9azDTwlMAQAskCXNAUBjCcwBkxfeAEsASZtFaTtqAj7kJktLwFECS8CCN8DWgMuXZW9wAaO5EfhpA8ahEUwX8nvI2KsxgDfgKWQrQ8R0IcE2zphvDRAgTEaMeJYGFThEISG4L2SAADvK/BXuiTag+hU5rYDvGQPqRW0oIR5We1wDanCP6erN95WMa0ANXMB06RG/zVACLi/rDBMsirQZSsAFiP/MhGIimtYbI0pAA5xSCLEMUWQO5J3rYL8XPVYCMIJZjHTA9xvA4hGUMbbmGkAO50nV1GN51g1o7wee1D3W6bYbcL1AElFE9IjCIzKDugicacAHAC/Rd4psADmiCNKmcw3eBIjfAob5G+DX8wMlrItB+ZBHngAAAABJRU5ErkJggg=='
    }
    ,
     {
      name: 'ENS160 + AHT2X ',
      type: 'Sensor',
      description: 'Air Quality Sensor ENS160 with AHT2X Temperature and Humidity Sensor',
      MFR: 'COM-28380',
      pin_data: null,
      text_data:
      '┌─────────────────────────────────────────────────┐\n' +
      '│ ENS160 + AHT2X                                  │\n' +
      '│ AQI  0 - 5                                      │\n' +
      '│ TVOC 0 – 65,000                                 │\n' +
      '│ eCO2 400 – 65,000                               │\n' +
      '│                                                 │\n' +
      '│  VIN   3V3   GND   SCL   SDA   ADO   CS    INT  │\n' +
      '└───┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬───┘',
      image_data:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABABAMAAABYR2ztAAAAAXNSR0IB2cksfwAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAB5QTFRFAAAAL2qkmaa2ZYao0NPbUmF6LzhOqrvJUo/AwcbL5e1P5QAAAAp0Uk5TAP78/vz//xJZf3NBpVAAAAKSSURBVHic7VQ9b9swEM3mdDzRCrKKlB14JCm5XUMSATJKtLQ7rjgXaIBYWz6G5gcYCPpvexRlw45lD90K9AAJFt7hvXePR19c/K+/qbfn8/garn+cxSVl387gly+pMfzXSXz0Qowxt6dF3qFrgFMUaygAGxKA52EDr1UNY6MB4Hqw4SWuXQGhhkTW4FxDeWgY8LmGqnaNFyCGD4isXyvn7HfFCsg6G598jryBemW1LaIwyCeRVtfOUU7rJZTYMEGK9wOB1EydS3U2X4oqM6obZk/k8o2ldw8LxXKIJsWKzsMkewnAlZivrLIApSvragki2adYA1w9KMhyByAainjE+F4YiAOLEhhPPTGZL+OmRFzyrchP/Ei7BAk+UY2JokkpMNWQeMvHRvqGOA9HMXccpMWOXqRVmUm8qzwXXcO0gLhiQCkLFKMNU0AoF1W56JRygEpmumSCh0m+4ARKSNFMWX/alRVmUeuc9T43OjVAc13GTYeTJkmN0jIqe58tmiRCLYraVb4hFiQzRhc+jutO5FFDqplE/413QShIY3IuFH59DT650ehz4oIGByKYRVL8PQtZKC/CcCkgCltnLeQ4BYj7sDCbhBjGk/mSTFb9KNLiUBH9uNhSmIQgpcjLQEEwK3Tzsd2sjZYANBG5nNx2aVUlvsVst3kjwyPDE5JXsiOILfcCe5vZqjH2aFFWu+tDtgZ6n4wB/j0ksWv6Djo7WO1WwVjh4ljngk1xiHuKzABhcePssYCvJyMZIYKXLgjcHF1QFElxWrIcEujzTHE3wn7Sp2McKTB+PEuP3xzhIU9Ib/kJgeCTd5f/IMKDetT+jI8n3Pc5POGuWlyzUwYCxW8dnRYIImp4wl093Z/H/836A07RrdM9ywO5AAAAAElFTkSuQmCC'
     } 
     ,
    {
      name: 'DHT22',
      type: 'Sensor',
      description: 'DHT22 Temperature and Humidity Sensor',
      MFR: 'DHT22',
      pin_data: null,
      text_data:
      '┌───────────┐\n' +
      '│           │\n' +
      '│           │\n' +
      '│   DHT22   │\n' +
      '│           │\n' +
      '│ +   D   - │\n' +
      '└─┬───┬───┬─┘\n',
      image_data:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABABAMAAABYR2ztAAAAAXNSR0IB2cksfwAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAB5QTFRFAAAA1NXUvr685+fmDg4OpaSfQUA8zs7MdHJsfXp1+LVFjQAAAAp0Uk5TAP3/Hf74/IX7Y2s63FgAAAIcSURBVHic3ZTBitswEIYDfgIpmPaqAdE9uuigFxCix9agrvauCO3RhLD0WjauclvwC3ck24mVOHssSyeDCdKnmX9GYjab/8KajwTIO+i8LMindWJarTpyh5gWJUF7B6i+4j6V+7uAxAy0JVuxDoguJSCMflmR0YwCCeEsubghmkkgqRmhBLrtLTDuAyG/0/dGRjMmSECbZVwX24wBMD4jn/N3XxYryAVAx1BdWUpOQLPznAWAFcQsgJ4dALZXAIZmOcsPdGg5LIXmFpA6VZAdWsyxBJIGToBhlBr/AU8BYAHIrJERw7IAgwpQxgIQ0z21SSnQlmIwKIBuBLIMyAqhAKZOUhRCMQ7kAAVQTa1i6SRa2i+Ay3NJSMvgBjjLwDp4SsDbtgQ2s4zUczxuTP/UFEAlZyDdhLExuOcCmF5lvjbg5mfwvXougFkoAtzYPvSvSg0FMBM0CfA+KLRBLIFZKCpw0bsE6DgsgUkoN77HXyb8qVkAI0G51dGH2Dul/UhcCk6l0AfcdvFoEQhOhaEYQUhQG3qvjqT23uleHe1bMaNEV8eYDsKDi70KcX84lUNMvhjvkzynXHj9Zk7i19WUq6TNBSjtdNzt7Zu4HoPVi80VaqV2dpDfb+dkdehTAOX0H/kkmpVBmgmt9HFfHYpGXWo54FXp8IhvbR3YSINtepw31mYjlrI7D4nV4SntOcA6UMnyTb5r/wD4APYXVEeax8UgV4IAAAAASUVORK5CYII='
    } 
    ,
    {
      name: '6N137',
      type: 'OpAmp/Opto',
      description: 'DHT22 Temperature and Humidity Sensor',
      MFR: 'DHT22',
      pin_data: null,
      text_data:
      ' ┌───6N137───┐\n' +
      '─┤       VCC ├─\n' +
      ' │           │\n' +
      '─┤ VF+    VE ├─\n' +
      ' │           │\n' +
      '─┤ VF-    VO ├─\n' +
      ' │           │\n' +
      '─┤       GND ├─\n' +
      ' └───────────┘\n',
      image_data:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABABAMAAABYR2ztAAAAAXNSR0IB2cksfwAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAB5QTFRFAAAA8On31s/hyL3T+fn5pp2t1NDd39zm5+Lwt6/ApoTanQAAAAp0Uk5TAP///gr8cjSvtXR6DwUAAAJYSURBVHic1dS9c9MwFABwDSqm43M5jrF+btqsSJjQzUOapGPjU++ypTThjs3lXEq20JZjxwf8u8jPki3bqVlYeEPurPfL09OHzWL2l/g/AV/FvWB8Bas+wL8AQNYDZjoPr9L4KeABlOIJwL+CEfFOwK8AOsIBfAZ1vIy74Bm48T1uA882ABiQaIGqQfAhcGpYwG+qfKjzRB5d4DboAx6QSGswqbM6deAHBLYVmFYNUHFEpGaPLHB2CPUSMKC8jycG0BGa/2PRgl/m8dgAp0GkRFDWwmFMYNpYAMBrm0ckUO+QqVGso6hjwQ00wzZQgfsAuoE14KanXXkogGd2pTELpVUASw2eY0eU+VBd+I8WNEVZX6oE9WHEn7AtyoEwUhEeanBfPgetCdAfJCW4xqbw7eNgcVscZ/wgUbiirJ8E/mC1J/Vxjr9J4dYwDajiKAm8j6QUYdWob8Ech2xP6PP+oUFVw+4gRhq8Y/tiyNhmkWuBjQBUKglFvJ9gxsbZRlZCVOB3LkXsJeK0uA/X0s5CP9GFj29ZAdhntShuVClqkKDeYgJsmtKd9HISgkCo9BIP2ZqATtO1n5hJBC1AYXjEbktgXxwjNICB+ik0OBO4ct9uWooQusHB5bmUI3YWiTcuMEvRDYapLnfC+AfVqGBE0SDzkuIM2F3rA0JLUYnAmM/DUfXdcT5Bk1xG6pcGbB4e7wJsJqPFnZQpzwWmuwDfnGZcyiVbq2i5CzCeMQ22bLpZ7KxAkdP+OKMtwPNw2xzpVBAv+sFajfrBubrsB/xj1g86Ax3wz+MPhMOw/hNWW5oAAAAASUVORK5CYII='
    } 
    ,
    {
      name: 'Resistor',
      type: 'Discrete',
      description: 'Resistor',
      MFR: 'R',
      pin_data: null,
      text_data:
      ['──/////──\n' +
      '       Ω\n'],
      image_data:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABABAMAAABYR2ztAAAAAXNSR0IB2cksfwAAAAlwSFlzAAAOxAAADsQBlSsOGwAAAB5QTFRFAAAAzLKK3wsKp4llhUkO1cWpzMnEX19f0L8l1kM6uVcIQAAAAAp0Uk5TAP/////9d////yyk2eIAAADrSURBVHic7ZKxbsIwEIbdIcz94xqREZgYw6WqupI8ABY6ZjIkL9ChM+qSFXXK29aXFKSYIBYWJH/ycNL/6RzfRalA4Gmp6PVcTqw5XOWW29O0LyPMjth6ecRsDX+eWBPAgicwI55z8su73IW2MTxsEQGIV3J04Uo0R0wHwksvJAsnpL2AgVDeFuQ9FUvbpBNwEcy+E/Z1XVuMCTAuqtW344vGBP0h2f1vuH4FxgSZw7qbw5sIukm9OSgQrZdysoIcDaXeMkqizZJat4vUasp+6N3bhbK0yc3/fTrL/QbSo73cOsHI/xAIBB7IH1KuPbXzHyuIAAAAAElFTkSuQmCC'
    }  
    ,
    {
      name: 'Capacitor',
      type: 'Discrete',
      description: 'Polarised Capacitor',
      MFR: 'C',
      pin_data: null,
      text_data:
      '+\n' +
      '─┨┠─\n',
      image_data:
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABABAMAAABYR2ztAAAAAXNSR0IB2cksfwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAB5QTFRF///+KsX429/YHWuTIZrMJkZZesbpEyMrX4KOubaqeGVSLAAAAnZJREFUeJzt0ztv2zAQAGCBW8aDVCNjYKBBNAok46wCqSBrcbxYo+MCQtbCUZmxSCqD3oqgSa1/W0qyUj/TDt1absZ9uuPd0UHwTx1WFCdvxl0Kb4ozjviWYDeRwSg5LE4BlBSHqww9gOiwYPVHCBEifUjEL0pEXEHEca9g9Q1PQzNKUlBc610Rv4CIMJXyE4AIRbojPIBRohAN91fVsF2Fxd8FSJxlUhJ0Z1OwukIDWSmlMdCLjSHUqjRpxIkw6QFM10GsJRoFMpNKqCYa8WSwVmT4fqbVjFT67i7jbY5McpierAGLWuNI6JR3ADINg6KvwoY/rBUafX4A3RQgCDlXyWDVSwNQouZKdp9HRqVa8Q/qcrICz5ZbazT4VbVAkJeKi8G0B6WvTxp412GW3Q0KL86L1TTqZSm5zrjRHRBKDIrQwLwHcU2ShEIrOpBwMb0JBRR9H3G9dHws0PZCpnM/q+vqum+09kITH78KSCKMHN2/TqKub7+qBpT9MrLkuKruJ7/2uXSP6IEt2xwpjM5dNf78CgK2dO6xAU0OpfxunaP8em1hcXVRtaARzcrCKi/r9WezpJUYWxNynQ6I7OJpr7A2UZm5ICof2HoO9kyu6sAMQuGI8om//VoKVnnR5cAoqohe/Bjip70C9VVe5adsuCWOvKCmETXOrVtMA+ajw2BDoK9NKMUx0WJxErCNcDuO3E/IIFxROY9bcbIpzigvXI7cjWcPwVkj6p0c5Bxe3Frxxf9oxBZoe3mE+WVRPzVP5dt23N+U/D2KYhI04mixRyxp3j3HVrhdwCqcd/+ZZkpHu8B/5Vbz25jj3vNXxO/A//On5ydsJeXI5TLNqQAAAABJRU5ErkJggg=='
    }  
    ,
    {
      name: 'Diode',
      type: 'Discrete',
      description: 'Diode',
      MFR: 'Diode',
      pin_data: null,
      text_data:
      '─▷|─\n',
      image_data:
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABABAMAAABYR2ztAAAAAXNSR0IB2cksfwAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAB5QTFRFAAAAjIKAmkQw0W1J0dTVvLy8RzQutbCuuLq6uLi4l8L6gAAAAAp0Uk5TAPj///0P//tltQW66gsAAAGbSURBVHicrZSxTsMwEIa7WCqjU6hhjCN1r/0EEUZeydRkLIPLGhLkshUpKHOlVPC4XAISi+9cBF396ct/v92bWX6akb+2vrkngS6mmJuYov+zgnVW0IqytS8xRSRFaWpaAYNEUsz/QXHmjTAcKqc6qw+UYH0uTqX3b7jC18I3HB+G9V40ek1UetHeSq1SfBhmrJRyRSgGq4DYoinmbaNkpiWq2GitFZXifQIylYpwF2xoVDaGyNb7sKKzSmsApOJhRVUn4zfSJOXXQQU7JhnEWKWcIykKLgGQ2yQT4RSM19CDepBSI5da+IWegGwdrpMdAZB6BPhVWCEauRgB7bZhxWCTry6cCysqz6fCV849Iik4hFBwjnwDunj6BvghCLAhhyrcCCCXXplGjwKHPRsYZBIgESbFEo6dwB/3Ec7Npb/DgFnh3C43xNZiS7fzxhD7onDbU2VyQvEKT64zPra1LD7IpDljd1pxIIne8Gc6RZvTKWYbw/ckwEBBp6iMjygGi/wJfxQ1sgp+oYimMIIExhQ0AAoaAEUEYMMncg+EkMAhsPUAAAAASUVORK5CYII='
    }
];

    // INDUCTORS, TRANSISTORS, SWITCHES, CONNECTORS, POWER SOURCES, MOTORS

/*
Diode:     ─▶│─
Inductor:  ─∿∿∿─
NPN:       ─▶│
PNP:       ─◀│
Switch:    ─o/ o─
Connector: ─( )─
Battery:   ─| |‾─
Motor:     ─Ⓜ─
*/