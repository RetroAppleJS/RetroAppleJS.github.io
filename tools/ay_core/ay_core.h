/* Shared AY core ABI v1. All structures little-endian; no host imports. */
#ifndef AY_CORE_H
#define AY_CORE_H
#include <stdint.h>
uint32_t ay_abi_version(void);
uint32_t ay_config_buffer(void);
int32_t ay_create(uint32_t config_ptr);
int32_t ay_configure_chip(int32_t h, uint32_t chip, uint32_t model, uint32_t clock_hz);
int32_t ay_set_mix(int32_t h, uint32_t chip, uint32_t weights_ptr);
int32_t ay_write_now(int32_t h, uint32_t chip, uint32_t reg, uint32_t value);
int32_t ay_reset_chip_now(int32_t h, uint32_t chip);
int32_t ay_reset_transport(int32_t h, double origin_tick);
int32_t ay_render_until(int32_t h, double end_tick, uint32_t events_ptr, uint32_t event_count,
                        uint32_t left_ptr, uint32_t right_ptr, uint32_t capacity_frames);
int32_t ay_get_registers(int32_t h, uint32_t chip, uint32_t dest_ptr);
int32_t ay_get_position(int32_t h, uint32_t dest_ptr);
int32_t ay_state_size(int32_t h);
int32_t ay_save_state(int32_t h, uint32_t dest_ptr, uint32_t capacity_bytes);
int32_t ay_load_state(int32_t h, uint32_t src_ptr, uint32_t length_bytes);
int32_t ay_destroy(int32_t h);
uint32_t ay_event_buffer(int32_t h);
uint32_t ay_left_buffer(int32_t h);
uint32_t ay_right_buffer(int32_t h);
uint32_t ay_control_buffer(int32_t h);
uint32_t ay_state_buffer(int32_t h);
#endif
