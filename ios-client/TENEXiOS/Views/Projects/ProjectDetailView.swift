import SwiftUI

struct ProjectDetailView: View {
    let project: Project
    @State private var selectedTab = 0
    @State private var showingSettings = false
    @State private var showingCreateTask = false
    @EnvironmentObject var projectManager: ProjectManager
    
    var body: some View {
        VStack(spacing: 0) {
            // Tab selector
            Picker("", selection: $selectedTab) {
                Text("Tasks").tag(0)
                Text("Chats").tag(1)
                Text("Settings").tag(2)
            }
            .pickerStyle(SegmentedPickerStyle())
            .padding()
            
            // Tab content
            TabView(selection: $selectedTab) {
                TasksView(project: project)
                    .tag(0)
                
                ProjectChatsView(project: project)
                    .tag(1)
                
                ProjectSettingsView(project: project)
                    .tag(2)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
        }
        .navigationTitle(project.name)
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Menu {
                    Button(action: { showingCreateTask = true }) {
                        Label("New Task", systemImage: "plus.circle")
                    }
                    
                    Button(action: { showingSettings = true }) {
                        Label("Settings", systemImage: "gear")
                    }
                    
                    Divider()
                    
                    if let repo = project.repo, let url = URL(string: repo) {
                        Link(destination: url) {
                            Label("Open Repository", systemImage: "link")
                        }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $showingCreateTask) {
            CreateTaskView(project: project)
        }
        .sheet(isPresented: $showingSettings) {
            NavigationView {
                ProjectSettingsView(project: project)
                    .navigationTitle("Project Settings")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .navigationBarTrailing) {
                            Button("Done") {
                                showingSettings = false
                            }
                        }
                    }
            }
        }
        .onAppear {
            projectManager.selectProject(project)
        }
    }
}