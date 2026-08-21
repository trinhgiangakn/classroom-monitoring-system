/**
 * @file test_main.c
 * @brief Main test runner for STM32 Sensor Node firmware host-based unit test suite.
 */

#include <stdio.h>
#include <stdlib.h>
#include <time.h>

extern void run_filter_tests(int *total_run, int *total_passed);
extern void run_sensor_math_tests(int *total_run, int *total_passed);
extern void run_ble_json_tests(int *total_run, int *total_passed);

int main(void) {
    int total_run = 0;
    int total_passed = 0;
    clock_t start_time = clock();

    printf("====================================================\n");
    printf("     STM32 SENSOR NODE FIRMWARE UNIT TEST SUITE    \n");
    printf("====================================================\n");

    run_filter_tests(&total_run, &total_passed);
    run_sensor_math_tests(&total_run, &total_passed);
    run_ble_json_tests(&total_run, &total_passed);

    clock_t end_time = clock();
    double time_spent = (double)(end_time - start_time) / CLOCKS_PER_SEC;

    printf("\n====================================================\n");
    printf(" TEST SUMMARY:\n");
    printf("   Total Tests Executed : %d\n", total_run);
    printf("   Passed               : %d\n", total_passed);
    printf("   Failed               : %d\n", total_run - total_passed);
    printf("   Execution Time       : %.4f seconds\n", time_spent);
    printf("====================================================\n");

    if (total_passed == total_run && total_run > 0) {
        printf(" [RESULT] ALL FIRMWARE UNIT TESTS PASSED SUCCESSFULLY.\n");
        printf("====================================================\n");
        return 0;
    } else {
        printf(" [RESULT] SOME FIRMWARE UNIT TESTS FAILED.\n");
        printf("====================================================\n");
        return 1;
    }
}
