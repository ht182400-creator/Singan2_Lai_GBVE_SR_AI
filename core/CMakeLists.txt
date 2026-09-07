add_library(singan2_core
  src/mariner_reader.cpp
  src/readzfile.cpp
  src/zahyo_param.cpp
  src/wtable.cpp
  src/imageops.cpp
  src/c_si2.cpp
  src/all32.cpp
  src/algo.cpp
  src/country/country_registry.cpp
  src/country/countries/euro.cpp
  src/country/countries/singa_swiss_poland.cpp
  src/country/countries/malaysia.cpp
  src/country/countries/taiwan.cpp
  src/country/countries/etc.cpp
  src/country/countries/canada.cpp
  src/country/countries/_stubs_pending.cpp
)

target_include_directories(singan2_core PUBLIC
  $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
  $<INSTALL_INTERFACE:include>
)
