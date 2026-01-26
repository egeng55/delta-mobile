require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'DeltaBodyScanner'
  s.version        = package['version']
  s.summary        = 'Delta Body Scanner - 3D body scanning with LiDAR and photogrammetry'
  s.description    = 'Native Expo module for 3D body scanning using iPhone LiDAR sensor or photogrammetry'
  s.license        = { :type => 'MIT' }
  s.author         = { 'Delta' => 'dev@delta.app' }
  s.homepage       = 'https://github.com/delta/delta-body-scanner'
  s.platform       = :ios, '14.0'
  s.swift_version  = '5.4'
  s.source         = { :git => 'https://github.com/delta/delta-body-scanner.git', :tag => "v#{s.version}" }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '*.{h,m,mm,swift}'

  s.frameworks = 'ARKit', 'RealityKit', 'SceneKit', 'AVFoundation', 'Metal', 'MetalKit', 'ModelIO'
end
