// ProDOS 8 embedded-offline boot demonstration (DISKII S6,D1)
// Requires an Apple II configuration with DISKII in physical S6.
await apple.script.hide();
try {
  await apple.cpu.setSpeed(400); // 4× CPU throttle for boot
  console.log('Mounting embedded ProDOS 8 image in S6,D1...');
  console.log(await apple.disk.loadOffline({
    slot: 6, drive: 1, path: 'disks/ProDOS 8.dsk'
  }));
  await apple.reboot();
  console.log('Waiting for boot menu keyboard polling...');
  await apple.text.waitForReady({timeout:60000,stableMs:300,minPolls:8});
  // Apple II right-arrow = $15 (CTRL-U); RETURN = $0D.
  await apple.text.type('\x15\x15\r');
  await apple.text.waitForDrain({timeout:20000});
  console.log('Waiting for the BASIC.SYSTEM prompt...');
  await apple.text.waitFor(/(?:^|\n)\s*]/, {timeout:60000});
  await apple.text.waitForReady({timeout:20000,stableMs:250,minPolls:5});
  await apple.text.type('PRINT "HELLO WORLD"\r');
  await apple.text.waitForDrain({timeout:20000});
  await apple.text.waitForReady({timeout:15000});
  console.log('BASIC.SYSTEM demonstration complete.');
} finally {
  await apple.cpu.setSpeed(100); // restore normal CPU speed
  await apple.script.show();
}
