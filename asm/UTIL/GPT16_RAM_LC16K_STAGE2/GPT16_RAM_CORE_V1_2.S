; =============================================================================
; GPT16_RAM_CORE_V1_2.S
; Card-neutral resident RAM API core.
; =============================================================================

        ORG     $8D00

RAM_API_ENTRY_INIT
        JMP     RAM_INIT_IMPL
RAM_API_ENTRY_PRESENT
        JMP     RAM_PRESENT_IMPL
RAM_API_ENTRY_SELECT_BANK
        JMP     RAM_SELECT_IMPL
RAM_API_ENTRY_READ_BLOCK
        JMP     RAM_READ_IMPL
RAM_API_ENTRY_WRITE_BLOCK
        JMP     RAM_WRITE_IMPL
RAM_API_ENTRY_LOAD_OVERLAY
        JMP     RAM_LOAD_IMPL

        ORG     $8D20

RAM_INIT_IMPL
        LDA     #$00
        STA     RAM_INFO_READY
        STA     RAM_INFO_LAST_ERROR
        JSR     RAM_BACKEND_PROBE
        BCS     RAM_CORE_ERROR
        STA     RAM_INFO_BACKEND
        LDA     #RAM_INFO_READY_VALUE
        STA     RAM_INFO_READY
        LDA     RAM_INFO_BACKEND
        CLC
        RTS

RAM_PRESENT_IMPL
        LDA     RAM_INFO_READY
        CMP     #RAM_INFO_READY_VALUE
        BNE     RAM_NOT_INIT
        LDA     RAM_INFO_BACKEND
        CLC
        RTS

RAM_NOT_INIT
        LDA     #RAM_E_NOT_INIT
        SEC
        RTS

RAM_SELECT_IMPL
        JSR     RAM_REQUIRE_READY
        BCS     RAM_CORE_RETURN
        JMP     RAM_BACKEND_SELECT

RAM_READ_IMPL
        JSR     RAM_REQUIRE_READY
        BCS     RAM_CORE_RETURN
        JMP     RAM_BACKEND_READ

RAM_WRITE_IMPL
        JSR     RAM_REQUIRE_READY
        BCS     RAM_CORE_RETURN
        JMP     RAM_BACKEND_WRITE

RAM_LOAD_IMPL
        JSR     RAM_REQUIRE_READY
        BCS     RAM_CORE_RETURN
        JMP     RAM_BACKEND_LOAD

RAM_REQUIRE_READY
        PHA
        LDA     RAM_INFO_READY
        CMP     #RAM_INFO_READY_VALUE
        BEQ     RAM_READY_OK
        PLA
        LDA     #RAM_E_NOT_INIT
        SEC
        RTS
RAM_READY_OK
        PLA
        CLC
        RTS

RAM_CORE_ERROR
        STA     RAM_INFO_LAST_ERROR
        SEC
RAM_CORE_RETURN
        RTS

RAM_CORE_END
        .ASSERT RAM_CORE_END <= $8D80, error, "RAM API core exceeds $8D00-$8D7F"
