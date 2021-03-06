Contributing
============

If you wish to contribute please read the following quick guide, but first, we want to thank all the helpful sources of code, inspiration and tooling that made this entire project possible. [CREDITS.md](docs/CREDITS.md)


# Issues (bug reporting)
Generally, bug reports should be in the following format:

 1. Description (Brief description of the problem)
 2. Input (input that is causing problems)
 3. Expected Output (Output that is expected)
 4. Actual Output

## Example bug report (issue with the assembler)

**Description:**
The assembler halts without error on a label identifier that is not followed by opcode on the same line. 

**Input:**
    
<pre>
*=$C000
    NOP
L1  
    LDX #$FF
    RTS
</pre>

**Expected output:**

<pre>
starting assembly
pass 1

* = $C000
C000         NOP
C002 L1 
C002         LDX #$FF
C004         RTS
</pre>


**Actual Output:**
<pre>
starting assembly
pass 1

* = $C000
C000         NOP
C002 L1 
</pre>

# Want a Feature?
You can request a new feature by submitting an issue. If you would like to implement a new feature feel free to issue a Pull Request.

# Pull requests (PRs)
PRs are awesome. However, before you submit your pull request consider the following guidelines:

 - Search GitHub for an open or closed Pull Request that relates to your submission. You don't want to duplicate effort.
 - When issuing PRs that change code, make your changes in a new git branch based on develop:

   ```bash
   git checkout -b my-fix-branch develop
   ```

 <!-- - Run the full test suite before submitting and make sure all tests pass (obviously =P).
 - Try to follow our [**coding style rules**]().
   Breaking them prevents the PR to pass the tests.
 - Refrain from fixing multiple issues in the same pull request. It's preferable to open multiple small PRs instead of one
   hard to review big one. Also, don't reuse old forks (or PRs) to fix new issues.
 - If the PR introduces a new feature or fixes an issue, please add the appropriate test case.)
 - We use commit notes to generate the changelog. It's extremely helpful if your commit messages adhere to the
 [**Git Commit Guidelines**](). 
 - If we suggest changes then:
   - Make the required updates.
   - Re-run the Angular test suite to ensure tests are still passing.
   - Rebase your branch and force push to your GitHub repository (this will update your Pull Request):

   ```bash
   git rebase develop -i
   git push origin my-fix-branch -f
   ```
   -->
 - After your pull request is merged, you can safely delete your branch.

If you have time to contribute to this project, we feel obliged that you get credit for it.
These rules enable us to review your PR faster and will give you appropriate credit in your GitHub profile.
We thank you in advance for your contribution!

<!--# Joining the team
We're looking for members to help maintaining the AppleII IDE.
Please see [this issue]() to express interest or comment on this note.-->


# Resource dependency tree

![Application map](http://www.plantuml.com/plantuml/png/PTAzRi8m40VmdQV8sDv0AwHsvWEA6586rArIT8cFOE8FotQQzkthG8naUSlzSlS_dUIbysYzv8f9D3CemWVzpYzUYjaCe03ObLy00hsst-h9O_qS68gW5HeZQ26Hg_dLFRGn_VlRwsAajD5gwNBzuOnqneoxBecmA1kqB9_dEhVBa5j7VovN8_g7Njtfi0t5TFVg14009K0jABbzTIghHbkAWsDzFpcjgxRdMK_ZueBjRWtGjsqQlbtlRusDwUDif12NKemJTFQ5uuocvCsn191QXTnMw1h5FJfmTTRAuq1EItf18MxpyPz4sp4zg0Gtny-FmtxS6wLrQCPwIOfDx-OV)

![Bizzdesign](http://www.plantuml.com/plantuml/png/ZLHDRvj043rtViKexQqgbIBr4haeAROfQXj7WjmiMGkiyIQmY_OZhTJsltV1hBT0cvY3PPZtthnvit2jD97QD3MeHyPR8ac3aXQQyAgcYqLE3-I92Hc6-1DUIM5u6Gd9gSJB3_0RL2kPflWct-GFbeGFH5uHMHnOGpHzdnl5E5NgdUYh7frI-SGA-Z-uEfPFUF9lF6dRcXL4Cy7dbBNXHLTvXhCV89uKYQOLd7Bz3Ajm64-R33_db4GJ5mB0ALwyY9d-RF8B90hZ9CF5ufHD68x2V_rf20TmHj_oagf7BLgdirkcNpejFyzKxSQR6_d9XAXpyQCNkhcxp3QRhrR8hVSiJv7WUrPjkMdjr5JsKj4wtjtVBNjFi_dcZaQMkWB597cxvSbovPpPl-SO0nXvMpMc9beSJQs-tKz3mf6FCJUbMZDUASVTfQiiIsxZr8huupRJc4Tp4eWsj-iaxkbkZ2bviXhVlDlC2vtjvP61PDL11x_2ZWqZ-q5DztzNC32jlHrI1kzqG8w61tTAWb9yvvRcTWt3ENHgzXQ6adlabUTDR7aG0AXfHNc9tNFmAyShzxt0uStwQ2_m9ymYaFWyq7qY7CplVGBqRxXjUsmEr_R7DFKV)


