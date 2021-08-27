Contributing
============

If you wish to contribute please read the following quick guide.

# Issues (bug reporting)
Generally, bug reports should be in the following format:

 1. Description (Brief description of the problem)
 2. Input (input that is causing problems)
 3. Expected Output (Output that is expected)
 4. Actual Output (Actual AppleII IDE output)

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
