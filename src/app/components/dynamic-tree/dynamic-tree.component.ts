import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { CollectionViewer, DataSource } from '@angular/cdk/collections';
import { FlatTreeControl } from '@angular/cdk/tree';
import { Observable, from as observableFrom } from 'rxjs';
import { FoldersService } from '../../_services/folders.service';

type Folder = any;

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
  treeControl!: FlatTreeControl<Folder>;
  showFolderTree = false;

  constructor(
    private foldersSrv: FoldersService,
  ) {
    this.dataSource = new FoldersDataSource(foldersSrv);
  }

  ngOnInit(): void {
    const getLevel = (node: Folder) => 0;
    const isExpandable = (node: Folder) => false;
    this.treeControl = new FlatTreeControl<Folder>(getLevel, isExpandable);
  }

  // TMP
  public checklistSelection = {
    isEmpty: () => true,
    isSelected: (node: Folder) => false,
  }

  public itemSelectionToggle(node: Folder): void {
    // TODO
  }

  public leafItemSelectionToggle(node: Folder): void {
    // TODO
  }

  public hasChild(node: Folder): boolean {
    // TODO
    return false;
  }
}


class FoldersDataSource implements DataSource<Folder> {
  constructor(
    private foldersSrv: FoldersService,
  ) {}

  connect(_collectionViewer: CollectionViewer): Observable<Folder[]> {
    // The collection is reasonably small, so collectionViewer can be ignored.
    // TODO
    return observableFrom([]);
  }

  disconnect(collectionViewer: CollectionViewer): void {
    // TODO
  }

}

