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
      '───┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬───┘',
      image_data:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABABAMAAABYR2ztAAAAAXNSR0IB2cksfwAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAB5QTFRFAAAAL2qkmaa2ZYao0NPbUmF6LzhOqrvJUo/AwcbL5e1P5QAAAAp0Uk5TAP78/vz//xJZf3NBpVAAAAKSSURBVHic7VQ9b9swEM3mdDzRCrKKlB14JCm5XUMSATJKtLQ7rjgXaIBYWz6G5gcYCPpvexRlw45lD90K9AAJFt7hvXePR19c/K+/qbfn8/garn+cxSVl387gly+pMfzXSXz0Qowxt6dF3qFrgFMUaygAGxKA52EDr1UNY6MB4Hqw4SWuXQGhhkTW4FxDeWgY8LmGqnaNFyCGD4isXyvn7HfFCsg6G598jryBemW1LaIwyCeRVtfOUU7rJZTYMEGK9wOB1EydS3U2X4oqM6obZk/k8o2ldw8LxXKIJsWKzsMkewnAlZivrLIApSvragki2adYA1w9KMhyByAainjE+F4YiAOLEhhPPTGZL+OmRFzyrchP/Ei7BAk+UY2JokkpMNWQeMvHRvqGOA9HMXccpMWOXqRVmUm8qzwXXcO0gLhiQCkLFKMNU0AoF1W56JRygEpmumSCh0m+4ARKSNFMWX/alRVmUeuc9T43OjVAc13GTYeTJkmN0jIqe58tmiRCLYraVb4hFiQzRhc+jutO5FFDqplE/413QShIY3IuFH59DT650ehz4oIGByKYRVL8PQtZKC/CcCkgCltnLeQ4BYj7sDCbhBjGk/mSTFb9KNLiUBH9uNhSmIQgpcjLQEEwK3Tzsd2sjZYANBG5nNx2aVUlvsVst3kjwyPDE5JXsiOILfcCe5vZqjH2aFFWu+tDtgZ6n4wB/j0ksWv6Djo7WO1WwVjh4ljngk1xiHuKzABhcePssYCvJyMZIYKXLgjcHF1QFElxWrIcEujzTHE3wn7Sp2McKTB+PEuP3xzhIU9Ib/kJgeCTd5f/IMKDetT+jI8n3Pc5POGuWlyzUwYCxW8dnRYIImp4wl093Z/H/836A07RrdM9ywO5AAAAAElFTkSuQmCC'
     } 
];