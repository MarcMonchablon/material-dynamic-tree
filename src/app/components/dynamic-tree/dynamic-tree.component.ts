import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { CollectionViewer, DataSource } from '@angular/cdk/collections';
import { FlatTreeControl } from '@angular/cdk/tree';
import { Observable, from as observableFrom, BehaviorSubject } from 'rxjs';
import { FoldersService, Folder } from '../../_services/folders.service';

interface FlatFolderNode {
  id: string,
  title: string,
  data: Folder,
  parentIds: string[],
  children: {
    status: NodeChildrenStatus,
    items: FlatFolderNode[],
  }
}

enum NodeChildrenStatus {
  NO_CHILDREN = 'no-children',
  NOT_LOADED = 'not-loaded',
  LOADING = 'loading',
  LOADED = 'loaded',
  ERROR = 'error',
}

@Component({
  selector: 'app-dynamic-tree',
  templateUrl: './dynamic-tree.component.html',
  styleUrls: ['./dynamic-tree.component.scss']
})
export class DynamicTreeComponent implements OnInit {
  @Input() treeRequired!: boolean;
  @Input() treeForm!: UntypedFormControl;
  @Output() nodeSelectedEvent = new EventEmitter<string>();
  dataSource: FoldersDataSource;
  treeControl!: FlatTreeControl<FlatFolderNode>;
  showFolderTree = false;
  selectedId: string | null = null;

  constructor(
    private foldersSrv: FoldersService,
  ) {
    const getLevel = (node: FlatFolderNode) => node.parentIds.length;
    const isExpandable = (node: FlatFolderNode) => node.data.hasChildren;
    this.treeControl = new FlatTreeControl<FlatFolderNode>(getLevel, isExpandable);
    this.dataSource = new FoldersDataSource(foldersSrv);
  }

  ngOnInit(): void {
    this.selectedId = null;
  }

  // TMP
  public checklistSelection = {
    isEmpty: () => true,
    isSelected: (node: Folder) => false,
  }

  public itemSelectionToggle(node: FlatFolderNode): void {
    // TODO
    console.group('[DynamicTreeComponent] itemSelectionToggle');
    console.log('node: ', node);
    console.groupEnd();
  }

  public leafItemSelectionToggle(node: FlatFolderNode): void {
    // TODO
    console.group('[DynamicTreeComponent] leafItemSelectionToggle');
    console.log('node: ', node);
    console.groupEnd();
  }

  public hasChild(index: number, node: FlatFolderNode): boolean {
    // console.group('[DynamicTreeComponent] hasChild');
    // console.log('index: ', index);
    // console.log('node: ', node);
    // console.groupEnd();
    // TODO
    return node.data.hasChildren;
  }

  protected readonly NodeChildrenStatus = NodeChildrenStatus;
}


class FoldersDataSource implements DataSource<FlatFolderNode> {
  private nodes$ = new BehaviorSubject<FlatFolderNode[]>([]);

  constructor(
    private foldersSrv: FoldersService,
  ) {
    this.foldersSrv.getRootFolders().then((folders: Folder[]) => {
      const rootNodes = folders.map(folder => this.folderToFlatNode(folder, []));
      console.group('[FoldersDataSource] getRootFolders OK');
      console.log('folders: ', folders);
      console.log('rootNodes: ', rootNodes);
      console.groupEnd();
      this.nodes$.next(rootNodes);
    });
  }

  public connect(_collectionViewer: CollectionViewer): Observable<FlatFolderNode[]> {
    // The collection is reasonably small, so collectionViewer can be ignored.
    // TODO
    _collectionViewer.viewChange.subscribe({
      next: (d: any) => console.log('[FoldersDataSource::collectionViewer] viewChange: ', d),
    });

    return this.nodes$;
    // return observableFrom([]);
  }

  public disconnect(collectionViewer: CollectionViewer): void {
    // TODO
  }

  private folderToFlatNode(folder: Folder, parentIds: string[]): FlatFolderNode {
    return {
      id: folder.folderId,
      title: folder.title,
      data: folder,
      parentIds: parentIds,
      children: {
        status: folder.hasChildren ? NodeChildrenStatus.NOT_LOADED : NodeChildrenStatus.NO_CHILDREN,
        items: [],
      }
    };
  }

}

