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

![Application map](https://www.plantuml.com/plantuml/png/PTAzJiCm40VmlK-H4Mu8g1BC_KYfEeGE4HjITB5DwiOVbkqGU7i2neqiRxbVxkwlaxnn7gsNN569PWN5_C6-oekNOWLG0EpFDO3KwbtTzK9tAEvdXsBczaChZnDpMh875A8apjt-IRG3rPDAS7z-VJaTo-iYlKFpMuUiG_q68D1hEwTvx4BKh2qQ8zXQ8bTXEYWnu_FJuphIqcYrTBb-SifqnfIx8LbXKHAqD9_dEhVBbDl0lbskHemtlRhcL2rtRni01b03T88bjs-RkYNQiZ0Owd1oMhVzoBCUuc90TTW1Z7sVBgzsnxz6OiOu6ockYnJNRPYY_s_b1m00)

![Bizzdesign](http://www.plantuml.com/plantuml/png/fLL1RzfC43r_yojMV5NLLd8gLUebeYWkQGA7f5QHE76Ps0DiuvsrTjT9KTl_thMTnJOb258aC3FpvddVxBFtmZeqhbGvs7l91HfKmb3ga5Sv3OTtjCO7gSre97x2VqQNd8srOJBYmqVu3ROmqf5uTPSOdPAruZkQSpJfMYfqzFwkj99zEYgQyXQFCp8FCgKTF1P5BbDqKdDa6qJRCjQgq4pi3ZIb0GEm5I464-JCNzCSfHe8WLPCnc8utAvwDEe9_V_pqxAx76CiN6b8J7cfZQhlrb2DfwTItMedbvi5nracAnxCnSpXFQrrdf6nWuhrDfwTIZl7N6RegEwVdzezvGUoJgu2mScg4jpKZSbHZU1tu5sKwKUE_0IxaLVU3UVTe0TC0Fpi8oDNQnTvyghHVpkPESmxqHIwwAJda5cAp99NjGBx55H2Wb5tXSIjwNekAQtJYep0JB6qpjI8cZLzAiMPactf9VUeR6pttQ4k_2j_OYIx5wdt3b34xjX6sCuvAejeLDdWcHcrWBqIcwhV-aFb-Q7Y5CBQcpW126C8xRk9ldykTLfM_Gk-GSOLDVzd6-j8rNjpULC_p-rBxC06NnEJmNp1usytFH8V_qNoBCj4AnAlHVo8cmKdsaFyjQ--9ft4IRpBUXpfbMJaL6A-d_Tg3--E0wgfd9N5sQ_Hzg7hviB8mGiFkVqMWKf5WEpRQF3B2O1WL82SLiIPo6dfuCiFL8NNk3HQ2RVsOkFgYB6byI99f6X9M5Tccu5uyxKWlZQwBDwUmOm8FlaFTDvwuZoSVA9eKW4I7WmF4Ps3IzWc7M3jq7Q1xGb7d3NhXml_Kwhy3m00)


