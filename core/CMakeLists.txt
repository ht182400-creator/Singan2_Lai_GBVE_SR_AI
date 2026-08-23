add_library(singan2_core
  src/mariner_reader.cpp
  src/readzfile.cpp
  src/zahyo_param.cpp
  src/wtable.cpp
  src/imageops.cpp
  src/c_si2.cpp
  src/all32.cpp
  src/algo.cpp
)

target_include_directories(singan2_core PUBLIC
  $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
  $<INSTALL_INTERFACE:include>
)
